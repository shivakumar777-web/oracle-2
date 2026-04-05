export class AnalysisCancelledError extends Error {
  constructor() {
    super("Analysis cancelled.");
    this.name = "AnalysisCancelledError";
  }
}
