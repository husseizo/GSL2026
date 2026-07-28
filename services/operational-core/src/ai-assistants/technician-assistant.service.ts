import { Injectable } from '@nestjs/common';
import { RagService } from '../rag/rag.service';
import { RepeatRepairService } from '../vehicle-lifecycle/repeat-repair.service';
import { VehicleDigitalTwinService } from '../vehicle-lifecycle/digital-twin.service';

export interface TechnicianAssistParams {
  vehicleId: string;
  symptoms?: string[];
  dtcCodes?: string[];
  notes?: string;
  actorId?: string;
  correlationId?: string;
}

// Spec §11: "Never declare diagnosis as confirmed." Enforced at the prompt
// level (the system prompt explicitly forbids it) and structurally: this
// service never writes to DiagnosticSession/SuspectedCause itself — a
// technician who accepts a suggestion still has to record it through
// DiagnosticsService like any other finding. Reuses the Digital Twin
// (repair/DTC history) and repeat-repair flags that already exist rather
// than re-querying GarageJob/DiagnosticCode tables directly. See
// docs/architecture/rag-architecture.md.
@Injectable()
export class TechnicianAssistantService {
  constructor(
    private readonly rag: RagService,
    private readonly digitalTwin: VehicleDigitalTwinService,
    private readonly repeatRepair: RepeatRepairService,
  ) {}

  async assist(params: TechnicianAssistParams) {
    const [twin, repeatFlags] = await Promise.all([
      this.digitalTwin.getDigitalTwin(params.vehicleId),
      this.repeatRepair.listForVehicle(params.vehicleId),
    ]);

    const caseDescription = [
      `Vehicle: ${twin.identity.brand} ${twin.identity.model} (VIN ${twin.identity.vin ?? 'unknown'}, engine ${twin.identity.engineCode ?? 'unknown'})`,
      params.symptoms?.length ? `Reported symptoms: ${params.symptoms.join('; ')}` : '',
      params.dtcCodes?.length ? `DTCs: ${params.dtcCodes.join(', ')}` : '',
      params.notes ? `Technician notes: ${params.notes}` : '',
      twin.dtcHistory.length ? `Prior DTC history on this vehicle: ${twin.dtcHistory.map((d) => d.code).join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    await this.rag.ensurePromptSeeded('TECHNICIAN_ASSISTANT', {
      systemPrompt:
        'You are a technician diagnostic assistant for an automotive garage. Using ONLY the evidence provided (workshop manuals, technical service bulletins, OEM repair procedures, and this vehicle\'s own history), suggest likely causes, a recommended inspection sequence, required tools, likely parts, and estimated labour. NEVER declare a diagnosis as confirmed — always frame findings as "likely" or "suspected" pending physical inspection by a technician. Explicitly call out any safety-relevant systems (brakes, steering, airbags, fuel) mentioned in the evidence as warnings.',
      userPromptTemplate:
        'Case:\n{{case}}\n\nEvidence:\n{{context}}\n\nInstruction: {{uncertaintyInstruction}}\n\nRespond with: likely causes, recommended inspection sequence, required tools, likely parts, estimated labour, and safety warnings. Do not declare a confirmed diagnosis.',
      temperature: 0.2,
    });

    const result = await this.rag.retrieveAndGenerate({
      query: caseDescription,
      filter: { sourceTypes: ['WORKSHOP_MANUAL', 'TECHNICAL_SERVICE_BULLETIN', 'OEM_REPAIR_PROCEDURE', 'GARAGE_HISTORY', 'REPEAT_REPAIR'] },
      actorId: params.actorId,
      correlationId: params.correlationId,
      promptTemplateName: 'TECHNICIAN_ASSISTANT',
      variables: { case: caseDescription },
    });

    return {
      ...result,
      similarHistoricalJobs: twin.repairHistory.slice(0, 5),
      repeatRepairFlags: repeatFlags,
    };
  }
}
