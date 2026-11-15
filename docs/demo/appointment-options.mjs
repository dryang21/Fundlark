/** Discipline-neutral appointment types. Stored codes from older profiles are preserved. */
export const APPOINTMENT_OPTIONS = Object.freeze({
  resident: [
    ['clinical_resident', 'Clinical resident (any specialty)'],
    ['professional_resident', 'Professional / nonclinical resident'],
    ['clinical_fellow', 'Clinical or professional fellow'],
  ],
  postdoc: [
    ['research_postdoc', 'Postdoctoral research fellow'],
    ['clinical_fellow', 'Clinical or professional fellow'],
    ['postdoc_other', 'Other postdoctoral appointment'],
  ],
  staff: [
    ['research_staff', 'Research scientist / research staff'],
    ['research_engineer', 'Research engineer'],
    ['staff_other', 'Other research staff appointment'],
  ],
  faculty: [
    ['faculty', 'Faculty appointment'],
  ],
});
export function appointmentOptionsForStage(stage){
  return APPOINTMENT_OPTIONS[stage] || [];
}
export function isAppointmentAllowed(stage,value){
  return appointmentOptionsForStage(stage).some(([code]) => code === value);
}
