export const CLINIC = {
  name: "عيادات النعمة",
  phone: "01208744830",
  instapay: "01208744830",
  address: "شارع البحر، المحلة الكبرى",
};

const ERRORS: Record<string, string> = {
  DOCTOR_UNAVAILABLE: "الطبيب غير متاح حالياً",
  INVALID_NAME: "اكتب الاسم بشكل صحيح",
  INVALID_PHONE: "رقم الموبايل غير صحيح",
  INVALID_DATE: "التاريخ غير متاح",
  SLOT_PASSED: "الميعاد ده عدّى",
  DAY_OFF: "الطبيب إجازة في اليوم ده",
  INVALID_SLOT: "الميعاد خارج مواعيد الطبيب",
  PAYMENT_DISABLED: "طريقة الدفع دي غير متاحة",
  INSTAPAY_REF_REQUIRED: "اكتب اسم أو رقم المحوِّل",
  SLOT_TAKEN: "الميعاد اتحجز حالاً، اختار ميعاد تاني",
};

export function errorText(e: unknown) {
  const msg = (e as { message?: string })?.message ?? "";
  const key = Object.keys(ERRORS).find((k) => msg.includes(k));
  return key ? ERRORS[key] : "حصلت مشكلة، حاول تاني";
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "قيد المراجعة",
  confirmed: "مؤكد",
  cancelled: "ملغي",
  completed: "تم الكشف",
};
