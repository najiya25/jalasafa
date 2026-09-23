import type { WorkflowStep } from '../../shared/types';

/** The five judging-flow steps, shown on the ticket confirmation screen. */
export function Stepper({ steps, currentStatus }: { steps: WorkflowStep[]; currentStatus?: string }) {
  return (
    <ol className="stepper">
      {steps.map((step, index) => {
        const isCurrent = step.label === 'Status' && currentStatus != null;
        return (
          <li key={step.key}>
            <span className={`dot${isCurrent ? ' current' : ''}`} aria-hidden="true">
              {step.done ? '✓' : index + 1}
            </span>
            <span>
              <span className="step-label">{step.label}</span>
              <br />
              <span className="step-detail">{step.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
