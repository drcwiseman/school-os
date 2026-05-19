import React from "react";
import { useParams } from "react-router-dom";
import { ModuleCrud } from "../components/ModuleCrud";
import { OPERATIONS_MODULES, type OperationsModuleId } from "./operations-modules";

export const OperationModulePage: React.FC<{ moduleId: OperationsModuleId }> = ({ moduleId }) => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const mod = OPERATIONS_MODULES.find((m) => m.id === moduleId)!;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{mod.label}</h1>
          <p className="text-slate-400 mt-1">School operations — {schoolSlug}</p>
        </div>
      </div>
      <ModuleCrud
        title={mod.label}
        apiPath={mod.path}
        columns={[...mod.columns]}
        fields={[...mod.fields]}
      />
    </div>
  );
};
