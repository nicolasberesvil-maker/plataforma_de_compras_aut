import { iniciarJobCierreAutomatico, iniciarJobRecordatorioCierre } from './campanas.job.js';

export function iniciarJobs() {
  iniciarJobCierreAutomatico();
  iniciarJobRecordatorioCierre();
}
