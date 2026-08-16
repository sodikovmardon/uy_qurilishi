import CalculatorSection from '../components/calculator/CalculatorSection';
import SubmissionForm from '../components/projects/SubmissionForm';

/**
 * "/yangi-loyiha" page — project submission form on top, material calculator
 * below so both workflows stay reachable from the FAB nav item.
 */
export function NewProjectPage() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <SubmissionForm />
      <div className="mt-14">
        <CalculatorSection />
      </div>
    </div>
  );
}
