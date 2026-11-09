-- Save a doctor's slot duration and weekly availability as one transaction.
-- Reject schedule edits that would invalidate or overlap existing active bookings.
CREATE OR REPLACE FUNCTION public.save_doctor_schedule(
  _slot_minutes integer,
  _availability jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  local_today date := (now() AT TIME ZONE 'Africa/Cairo')::date;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF _slot_minutes IS NULL OR _slot_minutes < 5 OR _slot_minutes > 180 THEN
    RAISE EXCEPTION 'INVALID_SLOT_LENGTH' USING ERRCODE = '22023';
  END IF;

  IF _availability IS NULL
     OR jsonb_typeof(_availability) <> 'array'
     OR jsonb_array_length(_availability) > 50 THEN
    RAISE EXCEPTION 'INVALID_AVAILABILITY' USING ERRCODE = '22023';
  END IF;

  -- Serialize schedule edits with booking creation and other schedule saves.
  PERFORM 1 FROM public.doctors WHERE id = current_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCTOR_NOT_FOUND' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_availability) AS e(value)
    CROSS JOIN LATERAL jsonb_to_record(e.value) AS x(
      weekday smallint,
      start_time time,
      end_time time
    )
    WHERE x.weekday IS NULL
       OR x.weekday NOT BETWEEN 0 AND 6
       OR x.start_time IS NULL
       OR x.end_time IS NULL
       OR x.end_time <= x.start_time
       OR EXTRACT(SECOND FROM x.start_time) <> 0
       OR EXTRACT(SECOND FROM x.end_time) <> 0
  ) THEN
    RAISE EXCEPTION 'INVALID_AVAILABILITY_RANGE' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    WITH ranges AS (
      SELECT e.ordinality, x.weekday, x.start_time, x.end_time
      FROM jsonb_array_elements(_availability) WITH ORDINALITY AS e(value, ordinality)
      CROSS JOIN LATERAL jsonb_to_record(e.value) AS x(
        weekday smallint,
        start_time time,
        end_time time
      )
    )
    SELECT 1
    FROM ranges a
    JOIN ranges b
      ON a.weekday = b.weekday
     AND a.ordinality < b.ordinality
     AND a.start_time < b.end_time
     AND b.start_time < a.end_time
  ) THEN
    RAISE EXCEPTION 'OVERLAPPING_AVAILABILITY' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.doctor_id = current_user_id
      AND b.booking_date >= local_today
      AND b.status IN ('pending', 'confirmed', 'completed')
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(_availability) AS e(value)
        CROSS JOIN LATERAL jsonb_to_record(e.value) AS x(
          weekday smallint,
          start_time time,
          end_time time
        )
        WHERE x.weekday = EXTRACT(DOW FROM b.booking_date)::smallint
          AND b.start_time >= x.start_time
          AND b.start_time + make_interval(mins => _slot_minutes) <= x.end_time
          AND MOD(
            (EXTRACT(EPOCH FROM (b.start_time - x.start_time)) / 60)::integer,
            _slot_minutes
          ) = 0
      )
  ) THEN
    RAISE EXCEPTION 'SCHEDULE_CONFLICT_WITH_BOOKINGS' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings a
    JOIN public.bookings b
      ON b.doctor_id = a.doctor_id
     AND b.booking_date = a.booking_date
     AND b.id > a.id
    WHERE a.doctor_id = current_user_id
      AND a.booking_date >= local_today
      AND a.status IN ('pending', 'confirmed', 'completed')
      AND b.status IN ('pending', 'confirmed', 'completed')
      AND a.start_time < b.start_time + make_interval(mins => _slot_minutes)
      AND b.start_time < a.start_time + make_interval(mins => _slot_minutes)
  ) THEN
    RAISE EXCEPTION 'SLOT_DURATION_CONFLICT_WITH_BOOKINGS' USING ERRCODE = '23514';
  END IF;

  UPDATE public.doctors
  SET slot_minutes = _slot_minutes
  WHERE id = current_user_id;

  DELETE FROM public.doctor_availability
  WHERE doctor_id = current_user_id;

  INSERT INTO public.doctor_availability (doctor_id, weekday, start_time, end_time)
  SELECT current_user_id, x.weekday, x.start_time, x.end_time
  FROM jsonb_array_elements(_availability) AS e(value)
  CROSS JOIN LATERAL jsonb_to_record(e.value) AS x(
    weekday smallint,
    start_time time,
    end_time time
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_doctor_schedule(integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_doctor_schedule(integer, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_doctor_schedule(integer, jsonb) TO authenticated;

-- Lock the doctor row during booking creation so a concurrent schedule
-- change cannot race the availability check.
CREATE OR REPLACE FUNCTION public.create_booking(
  _doctor uuid, _date date, _time time, _name text, _phone text,
  _payment public.payment_method, _instapay_ref text, _notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  d public.doctors;
  local_now timestamp := (now() AT TIME ZONE 'Africa/Cairo');
  ok boolean;
  new_id uuid;
BEGIN
  SELECT * INTO d
  FROM public.doctors
  WHERE id = _doctor AND status = 'approved'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCTOR_UNAVAILABLE';
  END IF;

  _name := btrim(coalesce(_name, ''));
  _phone := regexp_replace(coalesce(_phone, ''), '\s', '', 'g');
  _instapay_ref := left(btrim(coalesce(_instapay_ref, '')), 100);
  _notes := left(btrim(coalesce(_notes, '')), 500);

  IF length(_name) < 2 OR length(_name) > 100 THEN RAISE EXCEPTION 'INVALID_NAME'; END IF;
  IF _phone !~ '^\+?[0-9]{8,15}
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_start_time_minute_precision
  CHECK (EXTRACT(SECOND FROM start_time) = 0);

ALTER TABLE public.doctor_availability
  ADD CONSTRAINT doctor_availability_minute_precision
  CHECK (
    EXTRACT(SECOND FROM start_time) = 0
    AND EXTRACT(SECOND FROM end_time) = 0
  );
 THEN RAISE EXCEPTION 'INVALID_PHONE'; END IF;
  IF EXTRACT(SECOND FROM _time) <> 0 THEN RAISE EXCEPTION 'INVALID_SLOT'; END IF;
  IF _date < local_now::date OR _date > local_now::date + 60 THEN RAISE EXCEPTION 'INVALID_DATE'; END IF;
  IF (_date + _time) <= local_now THEN RAISE EXCEPTION 'SLOT_PASSED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.doctor_days_off
    WHERE doctor_id = _doctor AND off_date = _date
  ) THEN
    RAISE EXCEPTION 'DAY_OFF';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.doctor_availability a
    WHERE a.doctor_id = _doctor
      AND a.weekday = EXTRACT(DOW FROM _date)::int
      AND _time >= a.start_time
      AND (EXTRACT(EPOCH FROM (a.end_time - _time)) / 60) >= d.slot_minutes
      AND (EXTRACT(EPOCH FROM (_time - a.start_time)) / 60)::int % d.slot_minutes = 0
  ) INTO ok;

  IF NOT ok THEN RAISE EXCEPTION 'INVALID_SLOT'; END IF;

  IF _payment = 'instapay' THEN
    IF NOT d.accepts_instapay THEN RAISE EXCEPTION 'PAYMENT_DISABLED'; END IF;
    IF length(_instapay_ref) < 3 THEN RAISE EXCEPTION 'INSTAPAY_REF_REQUIRED'; END IF;
  ELSE
    IF NOT d.accepts_clinic THEN RAISE EXCEPTION 'PAYMENT_DISABLED'; END IF;
  END IF;

  BEGIN
    INSERT INTO public.bookings (
      doctor_id, booking_date, start_time, patient_name, patient_phone,
      notes, payment_method, instapay_ref
    )
    VALUES (
      _doctor, _date, _time, _name, _phone, _notes, _payment, _instapay_ref
    )
    RETURNING id INTO new_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'SLOT_TAKEN';
  END;

  RETURN new_id;
END;
$;

-- Prevent direct or RPC-created bookings with second-level times from bypassing
-- the unique (doctor, date, start_time) slot key.
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_start_time_minute_precision
  CHECK (EXTRACT(SECOND FROM start_time) = 0);

ALTER TABLE public.doctor_availability
  ADD CONSTRAINT doctor_availability_minute_precision
  CHECK (
    EXTRACT(SECOND FROM start_time) = 0
    AND EXTRACT(SECOND FROM end_time) = 0
  );
