import React from "react";
import { useParams } from "react-router-dom";
import { PayrollPanel } from "../components/hr/PayrollPanel";

export const Payroll: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="text-slate-400 mt-1">Salaries, deductions, payslips, and payment runs</p>
        </div>
      </div>
      {schoolSlug && <PayrollPanel schoolSlug={schoolSlug} />}
    </div>
  );
};
