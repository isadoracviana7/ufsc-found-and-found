import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Settings2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Wrench,
  ShieldCheck,
  Eye,
  Play,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useApp } from "@/features/app-context";
import { ErrorMessage, Field, metadata, Restricted } from "@/features/common";
import { resources, fieldLabel } from "@/data/resources";
import type { RecordData } from "@/data/types";
import {
  clearDatabase,
  conferClaim,
  deleteResource,
  listResource,
  operation,
  request,
  retryConnection,
  saveResource,
} from "@/services/api";

export const Route = createFileRoute("/gestao")({
  head: () =>
    metadata(
      "Gestão do sistema",
      "Administração de objetos, usuários, locais, catálogos, reivindicações e rotinas do Protocolo UFSCAchados.",
    ),
  component: Admin,
});

function Admin() {
  const { role, currentUser, refresh, connection } = useApp();
  const [path, setPath] = useState("objetos");
  const [rows, setRows] = useState<RecordData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<RecordData | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [remove, setRemove] = useState<RecordData | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [confirmOperation, setConfirmOperation] = useState("");
  const [matchId, setMatchId] = useState("");
  const [consultId, setConsultId] = useState("");
  const [search, setSearch] = useState("");

  const resource = resources.find((r) => r.path === path);
  const operations = path === "operacoes";

  const load = useCallback(async () => {
    if (role !== "operador" || path === "operacoes") return;
    setLoading(true);
    setError("");
    try {
      setRows(await listResource(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [path, role]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resource || !edit) return;
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const fields = isNew
      ? resource.fields
      : resource.fields.filter((f) => resource.editFields.includes(f.key));
    const body: RecordData = {};
    fields.forEach((f) => {
      const value = String(form.get(f.key) ?? "");
      if (value !== "") body[f.key] = f.type === "number" ? Number(value) : value;
    });
    body[resource.idKey] = Number(edit[resource.idKey]);
    try {
      await saveResource(path, body, resource.idKey, !isNew);
      setEdit(null);
      await load();
      await refresh();
      toast.success(isNew ? "Registro criado." : "Alterações salvas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteRow() {
    if (!resource || !remove) return;
    setBusy(true);
    setError("");
    try {
      await deleteResource(path, Number(remove[resource.idKey]), resource.idKey);
      setRemove(null);
      await load();
      await refresh();
      toast.success("Registro excluído.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      setResult(await fn());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setConfirmOperation("");
    }
  }

  const columns = rows.length
    ? Object.keys(rows[0] ?? {})
    : (resource?.fields.map((f) => f.key).filter((k) => k !== "detalhe_seguranca_oculto") ?? []);
  const displayRows = rows.filter((r) =>
    Object.values(r).some((v) => String(v).toLowerCase().includes(search.toLowerCase())),
  );

  if (role !== "operador") return <Restricted />;

  return (
    <main className="page-width main-content fade-in">
      <div className="eyebrow">
        <Settings2 size={12} />
        Área do Protocolo
      </div>
      <h1 className="page-title">Gestão da comunidade</h1>
      <p className="page-description">Registros, catálogos e rotinas em um só lugar.</p>
      <div className="admin-layout">
        <nav className="admin-tabs" aria-label="Seções da gestão">
          {resources.map((r) => (
            <Button
              variant="ghost"
              key={r.path}
              className={path === r.path ? "active" : ""}
              onClick={() => {
                setPath(r.path);
                setSearch("");
                setError("");
              }}
            >
              {r.label}
            </Button>
          ))}
          <Button
            variant="ghost"
            className={operations ? "active" : ""}
            onClick={() => {
              setPath("operacoes");
              setError("");
            }}
          >
            <Wrench />
            Operações
          </Button>
        </nav>
        <section className="admin-content">
          <ErrorMessage message={!edit && !remove ? error : ""} />
          {resource && (
            <>
              <div className="admin-toolbar">
                <h2>
                  {resource.label}
                  <span className="ml-2 text-xs text-muted-foreground">{rows.length}</span>
                </h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Atualizar listagem"
                    onClick={() => void load()}
                  >
                    <RefreshCw className={loading ? "spin" : ""} />
                  </Button>
                  <Button
                    onClick={() => {
                      setIsNew(true);
                      setError("");
                      setEdit({
                        [resource.idKey]:
                          Math.max(99, ...rows.map((r) => Number(r[resource.idKey]))) + 1,
                      });
                    }}
                  >
                    <Plus />
                    Novo registro
                  </Button>
                </div>
              </div>
              <div className="flex gap-3 mb-5">
                <input
                  placeholder="Buscar nesta listagem..."
                  aria-label="Buscar na gestão"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-sm text-xs"
                />
                {path === "objetos" && (
                  <div className="flex gap-2 ml-auto">
                    <input
                      className="max-w-24 text-xs"
                      aria-label="Consultar objeto por ID"
                      type="number"
                      min={1}
                      placeholder="ID objeto"
                      value={consultId}
                      onChange={(e) => setConsultId(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      title="Consultar objeto por ID"
                      disabled={!consultId}
                      onClick={() =>
                        void run(async () =>
                          connection === "demo"
                            ? (rows.find((r) => r["id_objeto"] === Number(consultId)) ?? {
                                mensagem: "Objeto não encontrado.",
                              })
                            : request(`/objetos/${consultId}`),
                        )
                      }
                    >
                      <Eye />
                    </Button>
                  </div>
                )}
              </div>
              {loading ? (
                <div className="empty-state">
                  <LoaderCircle className="spin" />
                  Carregando registros...
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="report-table">
                    <thead>
                      <tr>
                        {columns.map((k) => (
                          <th key={k}>{fieldLabel(k)}</th>
                        ))}
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((r, i) => (
                        <tr key={String
