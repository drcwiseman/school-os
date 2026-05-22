import React from "react";
import { useParams } from "react-router-dom";
import { PayrollPanel } from "../components/hr/PayrollPanel";
import { useAuth } from "../state/AuthContext";
import { countryLabel } from "../../lib/currencies";

export const Payroll: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { currency, country } = useAuth();
  const regionLabel = countryLabel(country);

  return (
    <div className="space-y-6 animate-fade-in w-full min-w-0">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Salaries, deductions, and payslips in <span className="text-slate-300 font-medium">{currency}</span>
            {regionLabel ? <> · {regionLabel}</> : null}
          </p>
          <p className="text-slate-400 mt-1">Run payroll from employment contracts under HR → Employees</p>
        </div>
      </div>
      {schoolSlug && <PayrollPanel schoolSlug={schoolSlug} />}
    </div>
  );
};
