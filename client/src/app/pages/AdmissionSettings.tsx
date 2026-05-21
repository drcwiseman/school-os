import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Plus, Trash2, ChevronLeft, LayoutTemplate } from "lucide-react";

interface FormField {
  id: string;
  fieldName: string;
  fieldKey: string;
  fieldType: string;
  optionsJson: string[] | null;
  isRequired: boolean;
  orderIdx: number;
}

interface AdmissionForm {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export const AdmissionSettings: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [forms, setForms] = useState<AdmissionForm[]>([]);
  const [selectedForm, setSelectedForm] = useState<AdmissionForm | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  
  const [newFormName, setNewFormName] = useState("");
  const [newFormDesc, setNewFormDesc] = useState("");
  
  const [newField, setNewField] = useState<Partial<FormField>>({
    fieldName: "", fieldKey: "", fieldType: "text", isRequired: false
  });

  useEffect(() => {
    fetchForms();
  }, [schoolSlug]);

  const fetchForms = async () => {
    try {
      const res = await api.get(`/s/${schoolSlug}/api/admission-forms`);
      setForms(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const selectForm = async (form: AdmissionForm) => {
    setSelectedForm(form);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/admission-forms/${form.id}/fields`);
      setFields(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post(`/s/${schoolSlug}/api/admission-forms`, {
        name: newFormName,
        description: newFormDesc,
      });
      setForms([res.data, ...forms]);
      setNewFormName("");
      setNewFormDesc("");
      toast("Form created successfully", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForm) return;
    try {
      const payload = {
        ...newField,
        orderIdx: fields.length,
      };
      const res = await api.post(`/s/${schoolSlug}/api/admission-forms/${selectedForm.id}/fields`, payload);
      setFields([...fields, res.data]);
      setNewField({ fieldName: "", fieldKey: "", fieldType: "text", isRequired: false });
      toast("Field added", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!selectedForm || !window.confirm("Delete this field?")) return;
    try {
      await api.delete(`/s/${schoolSlug}/api/admission-forms/${selectedForm.id}/fields/${fieldId}`);
      setFields(fields.filter(f => f.id !== fieldId));
      toast("Field removed", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <header className="flex items-center gap-4 pt-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <Link to={`/s/${schoolSlug}/admissions`} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <LayoutTemplate className="w-6 h-6 text-blue-500" />
            Admission Form Builder
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Configure dynamic admission forms specifically for your region requirements.</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-5 border border-blue-200/50 dark:border-blue-900/30">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Create New Form Type</h3>
            <form onSubmit={handleCreateForm} className="space-y-3">
              <div>
                <label className="label">Form Name</label>
                <input required className="input" placeholder="e.g. O-Level Admissions" value={newFormName} onChange={e => setNewFormName(e.target.value)} />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" placeholder="e.g. For Senior 1 to Senior 4" value={newFormDesc} onChange={e => setNewFormDesc(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary w-full"><Plus className="w-4 h-4" /> Create Form</button>
            </form>
          </div>

          <div className="card border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold p-4 border-b border-slate-200 dark:border-slate-800">Existing Forms</h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {forms.map(f => (
                <button
                  key={f.id}
                  onClick={() => selectForm(f)}
                  className={`w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selectedForm?.id === f.id ? 'bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
                >
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{f.name}</div>
                  <div className="text-xs text-slate-500 truncate">{f.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedForm ? (
            <div className="card p-6 border-slate-200 dark:border-slate-800 shadow-sm min-h-[500px]">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedForm.name}</h2>
                  <p className="text-sm text-slate-500">Configure the fields that applicants will see.</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                {fields.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    No custom fields added yet. Add your regional specific fields below.
                  </div>
                ) : (
                  fields.map((f, i) => (
                    <div key={f.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                          {i + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            {f.fieldName}
                            {f.isRequired && <span className="text-[10px] uppercase bg-red-100 text-red-600 px-1.5 rounded">Required</span>}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">Key: {f.fieldKey} • Type: {f.fieldType}</div>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteField(f.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-semibold mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Field
                </h4>
                <form onSubmit={handleAddField} className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Field Display Name (e.g. PLE Index No)</label>
                    <input required className="input bg-white dark:bg-slate-900" value={newField.fieldName} onChange={e => setNewField({...newField, fieldName: e.target.value, fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_')})} />
                  </div>
                  <div>
                    <label className="label">Field Data Key (auto-generated)</label>
                    <input required className="input bg-slate-100 dark:bg-slate-800" value={newField.fieldKey} onChange={e => setNewField({...newField, fieldKey: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Input Type</label>
                    <select required className="input bg-white dark:bg-slate-900" value={newField.fieldType} onChange={e => setNewField({...newField, fieldType: e.target.value})}>
                      <option value="text">Short Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                      <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={newField.isRequired} onChange={e => setNewField({...newField, isRequired: e.target.checked})} />
                      Required Field
                    </label>
                  </div>
                  <div className="sm:col-span-2 pt-2">
                    <button type="submit" className="btn-primary w-full sm:w-auto"><Plus className="w-4 h-4" /> Save Field</button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="card min-h-[500px] flex flex-col items-center justify-center text-center p-8 border-slate-200 dark:border-slate-800">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mb-4">
                <LayoutTemplate className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">No Form Selected</h2>
              <p className="text-slate-500 max-w-sm mx-auto">Select a form from the sidebar or create a new one to start adding Uganda/Africa specific admission fields.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
