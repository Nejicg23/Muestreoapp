'use client';

import React, { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet,
  Upload,
  Clipboard,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  Check,
  Edit2,
  HelpCircle,
  Database,
  ArrowLeft,
} from 'lucide-react';
import {
  parseCSVText,
  parseExcelBuffer,
  ParsedInventoryItem,
} from '@/lib/inventory-importer';
import { importInventoryItems } from '@/app/actions/import';

const SAMPLE_CSV = `ID,Stk - Fis,Stk - Sis,⬛,PRODUCTO,Dif,Fecha,Obs,Valor
1000239,,2 u,⬜,Daeha Capx30,,,$15.00
1000256,,3 u3 f,⬜,Daeha Sobx30,,,$22.50
1000378,,7 u8 f,⬜,Daflon Comx1000Mgx30,,,$35.00
444,,4 u13 f,⬜,Daflon Comx500Mgx30,,,$28.00
99512,,2 u,⬜,Daflon Susp-Sachx1.000Mgx30,,,$19.80
101994,,3 u4 f,⬜,Dalivium Sol-Orx25Mg/10Mlx10 Sticks,,,$12.00
98414,,4 u,⬜,Dalivium Tabx25Mgx10,,,$14.50
1000193,,4 u5 f,⬜,Dalivium Tramax Tabx25/75Mgx10,,,$16.00
103150,,3 u2 f,⬜,Davintex Com-Recx120Mgx10,,,$18.50
103143,,3 u2 f,⬜,Davintex Com-Recx90Mgx10,,,$17.00
18852,,1 u,⬜,Deblax Cap-Blax100.000Uix1,,,$8.00
93684,,-,⬜,Deblax Cap-Blax100.000Uix2,,,$11.00
15452,,6 u8 f,⬜,Defal Comx30Mgx10,,,$24.00
52729,,7 u11 f,⬜,Defal Comx6Mgx20,,,$26.50
30119,,20 u6 f,⬜,Degraler Comx5Mgx10,,,$30.00
83263,,4 u6 f,⬜,Degraler Plus Comx5Mgx10,,,
46281,,-,⬜,Demulcil Sob-Naranjx4.25Grx30,,,
73016,,6 u,⬜,Densibone D G Tabx1500Mg/200Uix30,,,
1000130,,5 u6 f,⬜,Dermanutrix Skin Plus Sachx15Mlx14,,,
1000365,,2 u25 f,⬜,Desinflex Tabx30,,,
13242,,-,⬜,Desloran Tabx5Mgx10,,,
1000123,,7 u,⬜,Devisal Cb Capx100.000Uix1,,,
91837,,4 u2 f,⬜,Dexilant Capx30Mgx14,,,
91838,,5 u9 f,⬜,Dexilant Capx60Mgx14,,,
102355,,2 u23 f,⬜,Dexlanzopral Capx30Mgx30,,,
102155,,3 u5 f,⬜,Dexlanzopral Mic Capx60Mgx30,,,
91797,,2 u10 f,⬜,Dexopral Capx30Mgx30,,,
91796,,3 u27 f,⬜,Dexopral Capx60Mgx30,,,
90794,,-,⬜,Dha 200 Capx30,,,
87925,,2 u10 f,⬜,Diabaid Capx100/100Mgx20,,,
5125,,3 u14 f,⬜,Diamicron Mr Comx30Mgx30,,,
99040,,3 u8 f,⬜,Diapresan Com-Recx160Mgx30,,,
99039,,3 u7 f,⬜,Diapresan Comx80Mgx30,,,
95274,,2 u23 f,⬜,Diapresan D Comx160/12.5Mgx30,,,
95275,,2 u5 f,⬜,Diapresan D Comx160/25Mgx30,,,
95273,,4 u23 f,⬜,Diapresan D Comx80/12.5Mgx30,,,
3666,,2 u7 f,⬜,Diaren Comx200Mgx20,,,
397,,9 u15 f,⬜,Diclofenaco Tabx50Mgx20 Mk,,,
30677,,3 u38 f,⬜,Dicloxacilina Capx500Mgx50 Lste,,,
248,,3 u,⬜,Dicynone Capx500Mgx20,,,
1000295,,2 u12 f,⬜,Digeril Forte Sus Pocketx10Mlx30,,,
34283,,11 u12 f,⬜,Digesta Capx250Mgx20,,,
1000296,,4 u5 f,⬜,Digestotal Biliar Capx30,,,
1000094,,7 u2 f,⬜,Digestotal Forte Capx30,,,
91216,,4 u2 f,⬜,Digestotal Multienzimas Capx30,,,
1000297,,2 u9 f,⬜,Digestotal Pancreatico Capx30,,,
92052,,3 u11 f,⬜,Diosmin Sobx900/100Mgx15,,,
1000328,,7 u3 f,⬜,Diotul Com-Recx100Mgx30,,,
12702,,2 u10 f,⬜,Diovan Comx160Mgx28,,,
12701,,4 u13 f,⬜,Diovan Comx80Mgx28,,,
13335,,3 u14 f,⬜,Diovan Hct Comx160/12.5Mgx28,,,
13336,,2 u,⬜,Diovan Hct Comx160/25Mgx28,,,
12719,,2 u7 f,⬜,Diovan Hct Comx80/12.5Mgx28,,,
1000139,,13 u7 f,⬜,Dioxaflex Plus Comx50/4Mgx15,,,
36638,,4 u13 f,⬜,Dipemina Comx500Mgx30,,,
13908,,-,⬜,Dislep Comx25Mgx20,,,
1000276,,1 u,⬜,Disoflem Sobx100Mgx10,,,
1360,,1 u6 f,⬜,Dolgenal Comx20Mgx10,,,
1000168,,13 u9 f,⬜,Dolgenal Duo Capx10/25Mgx10,,,
99805,,9 u6 f,⬜,Dolgenal Sl Com-Subx30Mgx8,,,
72458,,2 u2 f,⬜,Dolo Curaflex Sobx15/1500Mgx15,,,
90486,,5 u1 f,⬜,Dolo Neurobion Retard Tabx20,,,
8810,,3 u5 f,⬜,Dolocox Capx200Mgx12,,,
103213,,-,⬜,Dolofinartrit Sobx15/1500Mgx15,,,
96079,,3 u22 f,⬜,Dololuvit Grax50Mgx30,,,
101176,,3 u15 f,⬜,Dolorgesic Capx400Mgx20,,,
101179,,3 u16 f,⬜,Dolorgesic Capx600Mgx20,,,
1000312,,3 u12 f,⬜,Dolorgesic Relax Capx4/600Mgx15,,,
92071,,4 u6 f,⬜,Dolux Comx90Mgx10,,,
1363,,6 u7 f,⬜,Dominium Comx20Mgx30,,,
2641,,-,⬜,Dorixina Relax Comx125/5Mgx10,,,
249,,2 u22 f,⬜,Doxium Capx500Mgx30,,,
34998,,3 u4 f,⬜,Droxilon Capx500Mgx20,,,
71917,,2 u4 f,⬜,Dueto Capx2.5/50Mgx30,,,
71916,,2 u,⬜,Dueto Capx5/100Mgx30,,,
97281,,6 u8 f,⬜,Duomo Hp Capx2/5Mgx30,,,
85731,,3 u,⬜,Duopas Capx400Mg/20Mgx10,,,
3225,,2 u10 f,⬜,Duphaston Tabx10Mgx20,,,
2024,,6 u6 f,⬜,Duspatalin Retard Capx200Mgx30,,,
1000053,,2 u24 f,⬜,E Zentius Comx10Mgx30,,,
1000054,,3 u20 f,⬜,E Zentius Comx20Mgx30,,,
1000369,,6 u10 f,⬜,Edapil Oral Tabx30,,,
1000222,,7 f,⬜,Elbrus Sobx1Grx20,,,
10081,,2 u6 f,⬜,Enalapril Tabx20Mgx20 Mk,,,
16804,,3 u44 f,⬜,Enalapril Tabx5Mgx50 Mk,,,
8752,,3 u11 f,⬜,Endial Comx1Mgx20,,,
69758,,1 u13 f,⬜,Endial Digest Comx1/200/100Mgx20,,,
26204,,3 u,⬜,Enema Fleet Adulto Fcox133Ml,,,
5092,,2 u,⬜,Enema Fleet Sol-Pedx66.6Ml,,,
26122,,2 u,⬜,Engystol Comx75/75Mgx50,,,
92336,,2 u18 f,⬜,Entero Kron Sob-Granuladx4Grx30,,,
31010,,9 u1 f,⬜,Enterogermina Amp-Bebx5Mlx10,,,
5358,,7 u1 f,⬜,Enterogermina Plus Amp-Bebx5Mlx5,,,
99027,,2 u7 f,⬜,Entresto Com-Recx50Mgx30,,,
34730,,1 u15 f,⬜,Epihierro Sobx100Mgx20,,,
102827,,3 u4 f,⬜,Equil Com-Recx20,,,
83984,,2 u,⬜,Esencial Capx30,,,
42544,,2 u10 f,⬜,Esmirtal Com-Recx10Mgx30,,,
66562,,1 f,⬜,Esomax Capx20Mgx14,,,
66563,,-,⬜,Esomax Capx40Mgx14,,,
54559,,-,⬜,Esoz Tabx40Mgx28,,,
97037,,2 u1 f,⬜,Espasmo Dolofor Tab-Recx10/125Mgx20,,,
33028,,6 u10 f,⬜,Espironolactona Comx25Mgx20 Ecqu,,,
88114,,2 u14 f,⬜,Estomacol Capx20Mgx20,,,
2091,,3 u20 f,⬜,Etec 1000 Capx1.000Mgx30,,,
94377,,-,⬜,Etoricox Tabx120Mgx14,,,
8424,,6 u24 f,⬜,Etron Capx500Mgx50,,,
1000237,,3 u20 f,⬜,Eukene Com-Recx40Mgx30,,,
1000238,,1 u20 f,⬜,Eukene H Com-Recx40/12.5Mgx30,,,
1561,,2 u,⬜,Eupasan Sobx5/0.015Grx20,,,
3857,,-,⬜,Euroclin Capx300Mgx30,,,
3669,,2 u9 f,⬜,Eurovir Comx800Mgx35,,,
32861,,-,⬜,Eurovir Tabx400Mgx15,,,
26468,,4 u15 f,⬜,Eutebrol Comx10Mgx30,,,
2504,,4 u,⬜,Eutirox Tabx100Mgx50,,,
18664,,5 u,⬜,Eutirox Tabx75Mcgx50,,,
1000368,,7 u10 f,⬜,Eutransil S Comx200/120Mgx30,,,
39149,,2 u17 f,⬜,Exforge Comx160/10Mgx28,,,
39150,,8 f,⬜,Exforge Comx160/5Mgx28,,,
63192,,2 u19 f,⬜,Exforge Hct Comx10/160/12.5Mgx28,,,
63190,,2 f,⬜,Exforge Hct Comx5/160/12.5Mgx28,,,
1000321,,1 f,⬜,Expansia Tabx75Mgx15,,,
77500,,-,⬜,Ezetimibe Simvas Tabx10/40Mgx14 Mk,,,
9548,,3 u2 f,⬜,Ezolium Capx20Mgx20,,,
9522,,2 u,⬜,Ezolium Capx40Mgx20,,,
1000308,,6 u21 f,⬜,Fanter Comx10Mgx30,,,
13455,,2 u,⬜,Femen Forte Capx400Mgx10,,,
66425,,-,⬜,Fenalex Tabx500Mgx10,,,
74932,,14 f,⬜,Fenofikan Capx160Mgx20,,,
75892,,1 u2 f,⬜,Ferroprotina Sob-Grax40Mgx30,,,
1312,,9 u7 f,⬜,Ferrum Amp-Bebx100Mgx5Mlx10,,,
1317,,1 f,⬜,Ferrum Folic Tab Mastx30,,,
1000394,,-,⬜,Fexuclue Tab-Recx40Mgx7,,,
50948,,3 u11 f,⬜,Flamydol Retard Capx100Mgx12,,,
843,,3 u4 f,⬜,Flanax Tabx550Mgx20,,,
72425,,2 u2 f,⬜,Flebodia Comx600Mgx30,,,
50149,,2 u14 f,⬜,Flexidol Comx250Mg/300Mgx20,,,
71809,,4 u,⬜,Flimox Comx10Mgx30,,,
71811,,10 f,⬜,Flimox Comx4Mgx30,,,
71810,,2 u12 f,⬜,Flimox Comx5Mgx30,,,
14876,,1 u6 f,⬜,Flogocox Com-Recx120Mgx7,,,
30034,,12 u12 f,⬜,Flogocox Com-Recx90Mgx14,,,
76083,,3 u13 f,⬜,Flogomax Comx10Mgx20,,,
94353,,-,⬜,Floratil Capx250Mgx10,,,
94349,,-,⬜,Floratil Ped Sobx250Mgx10,,,
37690,,3 u1 f,⬜,Flucomax Capx300Mgx2,,,
9884,,1 u,⬜,Fluconacx Capx150Mgx2,,,
8962,,18 u,⬜,Fluconazol Capx150Mgx1 Lste,,,
91582,,4 f,⬜,Fluidine Sobx100Mgx30,,,
91580,,2 u4 f,⬜,Fluidine Sobx200Mgx30,,,
1402,,3 u1 f,⬜,Fluimucil Oral Sobx200Mgx60,,,
2267,,3 u10 f,⬜,Fluimucil Tab-Efex600Mgx20,,,
52613,,6 u7 f,⬜,Fluritox Capx20,,,
85732,,7 u2 f,⬜,Fluzetrin F Capx500/60Mgx10,,,
38883,,2 u16 f,⬜,Fluzina Tabx10Mgx30,,,
92383,,5 u15 f,⬜,Fortzink Capx20Mgx20,,,
91578,,1 u21 f,⬜,Forxiga Comx10Mgx30,,,
75269,,5 u5 f,⬜,Fosfocil Capx500Mgx12,,,
40709,,1 u3 f,⬜,Fugos Tabx300Mgx4,,,
88026,,4 u,⬜,Furacam Comx500Mgx15,,,
3777,,2 u73 f,⬜,Furosemida Tabx40Mgx100 Genf,,,`;

interface Props {
  existingSessions: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: Date | string;
  }>;
}

export default function ImportClient({ existingSessions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Tab de entrada
  const [inputTab, setInputTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');

  // Configuración de destino
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [newTitle, setNewTitle] = useState(
    `Inventario Importado - ${new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    })}`
  );
  const [auditorName, setAuditorName] = useState('Auditor Principal');
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    existingSessions[0]?.id || ''
  );

  // Lista de items procesados
  const [items, setItems] = useState<ParsedInventoryItem[]>([]);
  const [sessionDestination, setSessionDestination] = useState<'formal' | 'quick'>('formal');
  const [filterMode, setFilterMode] = useState<'all' | 'incidences' | 'valid'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Manejador de carga de archivo (.xlsx / .csv)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const arrayBuffer = await file.arrayBuffer();
      const parsed = parseExcelBuffer(arrayBuffer);
      setItems(parsed);
    } else {
      const text = await file.text();
      const parsed = parseCSVText(text);
      setItems(parsed);
    }
  };

  // Manejador de texto pegado
  const handleParsePasted = () => {
    if (!pastedText.trim()) return;
    const parsed = parseCSVText(pastedText);
    setItems(parsed);
  };

  // Análisis dinámico en tiempo real mientras el usuario digita o pega texto en el textarea
  const livePastedStats = useMemo(() => {
    if (!pastedText.trim()) return null;
    try {
      const parsed = parseCSVText(pastedText);
      const incItems = parsed.filter((i) =>
        i.incidences.some((inc) => inc.severity === 'warning' || inc.severity === 'error')
      );
      return {
        total: parsed.length,
        incidences: incItems.length,
        incItems,
        parsed,
      };
    } catch {
      return null;
    }
  }, [pastedText]);

  // Cargar automáticamente los 161 ítems de ejemplo del usuario
  const handleLoadSample = () => {
    const parsed = parseCSVText(SAMPLE_CSV);
    setItems(parsed);
  };

  // Edición interactiva de una fila (factor, cajas, fracciones, costo caja)
  const handleUpdateItem = (
    rowId: number,
    field: 'factor' | 'packs' | 'loose' | 'boxCost',
    val: number
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.rowId !== rowId) return item;

        const updated = { ...item };
        if (field === 'factor') updated.factor = Math.max(1, val);
        if (field === 'packs') updated.packs = Math.max(0, val);
        if (field === 'loose') updated.loose = Math.max(0, val);
        if (field === 'boxCost') updated.boxCost = Math.max(0, val);

        // Recalcular costo fracción si hay costo de caja y factor
        if (updated.boxCost > 0 && updated.factor > 0) {
          updated.unitCostCalculated = Number((updated.boxCost / updated.factor).toFixed(4));
        }

        // Recalcular stock teórico
        updated.calculatedStock = updated.packs * updated.factor + updated.loose;

        // Recalcular incidencias
        updated.incidences = [];
        if (updated.loose >= updated.factor && updated.factor > 1) {
          updated.incidences.push({
            type: 'loose_exceeds_factor',
            message: `Fracciones sueltas (${updated.loose}f) iguales o mayores al factor de caja (${updated.factor}).`,
            severity: 'info',
          });
        }
        if (updated.packs === 0 && updated.loose === 0) {
          updated.incidences.push({
            type: 'zero_stock',
            message: 'Stock en 0.',
            severity: 'info',
          });
        }

        return updated;
      })
    );
  };

  // Acción rápida: asignar factor 1 a todas las incidencias
  const handleAutoResolveNoFactor = () => {
    setItems((prev) =>
      prev.map((item) => {
        const hasNoFactor = item.incidences.some((i) => i.type === 'no_factor');
        if (hasNoFactor) {
          const factor = 1;
          const calculatedStock = item.packs * factor + item.loose;
          return {
            ...item,
            factor,
            calculatedStock,
            incidences: item.incidences.filter((i) => i.type !== 'no_factor'),
          };
        }
        return item;
      })
    );
  };

  // Enviar a la base de datos
  const handleCommitImport = async () => {
    if (items.length === 0) return;
    setIsImporting(true);
    setImportStatus('Guardando en base de datos PostgreSQL...');

    const payloadItems = items.map((i) => ({
      sku: i.sku,
      description: i.description,
      systemStock: i.calculatedStock,
      packQuantity: i.factor,
      boxCost: i.boxCost,
      unitCostCalculated: i.unitCostCalculated,
      location: i.location || 'Bodega Principal',
      rawMetadata: {
        rawStockString: i.rawStock,
        packsOriginal: i.packs,
        looseOriginal: i.loose,
        boxCost: i.boxCost,
        unitCostCalculated: i.unitCostCalculated,
      },
    }));

    const res = await importInventoryItems({
      sessionId: targetMode === 'existing' ? selectedSessionId : undefined,
      createNewSession: targetMode === 'new',
      newSessionTitle: newTitle,
      createdBy: auditorName,
      sessionType: sessionDestination,
      items: payloadItems,
    });

    if (res.success && res.sessionId) {
      setImportStatus('¡Importación exitosa! Redirigiendo...');
      setTimeout(() => {
        if (sessionDestination === 'quick') {
          router.push(`/inventario-rapido?sessionId=${res.sessionId}`);
        } else {
          router.push(`/conteo/${res.sessionId}`);
        }
      }, 700);
    } else {
      alert('Error en importación: ' + (res.error || 'Desconocido'));
      setIsImporting(false);
      setImportStatus(null);
    }
  };

  // Contadores y métricas
  const totalCount = items.length;
  const incidenceItems = items.filter((i) =>
    i.incidences.some((inc) => inc.severity === 'warning' || inc.severity === 'error')
  );
  const totalIncidencias = incidenceItems.length;
  const totalCalculatedUnits = items.reduce((acc, i) => acc + i.calculatedStock, 0);
  const totalPacks = items.reduce((acc, i) => acc + i.packs, 0);
  const totalLoose = items.reduce((acc, i) => acc + i.loose, 0);

  // Filtrado de la tabla de revisión con búsqueda dinámica por Nombre, SKU o Incidencia
  const searchLower = searchFilter.trim().toLowerCase();
  const filteredList = items.filter((item) => {
    const matchesSearch =
      !searchLower ||
      item.sku.toLowerCase().includes(searchLower) ||
      item.description.toLowerCase().includes(searchLower) ||
      item.incidences.some((inc) => inc.message.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;

    if (filterMode === 'incidences') {
      return item.incidences.some(
        (i) => i.severity === 'warning' || i.severity === 'error'
      );
    }
    if (filterMode === 'valid') {
      return !item.incidences.some(
        (i) => i.severity === 'warning' || i.severity === 'error'
      );
    }
    return true;
  });

  // Conteo dinámico de incidencias dentro de la búsqueda activa
  const incidencesInSearch = filteredList.filter((i) =>
    i.incidences.some((inc) => inc.severity === 'warning' || inc.severity === 'error')
  ).length;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2.5 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-cyan-400" />
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Importador Inteligente de Inventarios
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Interpreta automáticamente formatos de stock (ej: <span className="font-mono text-cyan-300">2u5f</span> = 2 Unidades y 5 Fracciones) y extrae factores (ej: <span className="font-mono text-cyan-300">...Mgx28</span> = 28 fracciones por unidad).
            </p>
          </div>
        </div>

        <button
          onClick={handleLoadSample}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white transition-all shadow-lg shadow-cyan-600/25 flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Cargar Datos de Ejemplo (161 Productos)</span>
        </button>
      </div>

      {/* Zona de Carga de Datos (Si aún no se han procesado ítems) */}
      {items.length === 0 ? (
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-700/80 pb-4">
            <button
              onClick={() => setInputTab('upload')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                inputTab === 'upload'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Subir Archivo Excel / CSV</span>
            </button>
            <button
              onClick={() => setInputTab('paste')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                inputTab === 'paste'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white'
              }`}
            >
              <Clipboard className="w-4 h-4" />
              <span>Pegar desde Excel (Ctrl+V)</span>
            </button>
          </div>

          {inputTab === 'upload' ? (
            <div className="border-2 border-dashed border-slate-600 hover:border-cyan-500/80 rounded-2xl p-12 text-center transition-all bg-slate-900/40 relative">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="w-14 h-14 text-cyan-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">
                Arrastra tu archivo Excel (.xlsx) o CSV aquí
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Detecta las columnas: <span className="font-mono text-cyan-300">ID, Stk - Sis, PRODUCTO</span>. Interpreta automáticamente <span className="font-mono text-slate-200">2 u 5 f</span> y factores como <span className="font-mono text-slate-200">x30</span>, <span className="font-mono text-slate-200">x28</span>, etc.
              </p>
              <div className="mt-4 inline-block px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700">
                Seleccionar archivo del equipo
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="text-xs font-semibold text-slate-300 block">
                Pega aquí las filas copiadas desde tu hoja de cálculo:
              </label>
              <textarea
                rows={7}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="ID,Stk - Sis,PRODUCTO&#10;1000239,2 u,Daeha Capx30&#10;1000256,3 u3 f,Daeha Sobx30"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
              />

              {/* Previsualización dinámica en vivo mientras se digita */}
              {livePastedStats && (
                <div className="bg-slate-900 border border-cyan-500/40 rounded-xl p-4 space-y-3 text-xs shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      Análisis dinámico mientras digitas:
                    </span>
                    <span className="font-mono text-cyan-300 font-bold text-sm">
                      {livePastedStats.total} filas leídas
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {livePastedStats.total - livePastedStats.incidences} Correctos
                    </span>
                    {livePastedStats.incidences > 0 ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {livePastedStats.incidences} Incidencias Detectadas
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Todos los factores detectados sin incidencias</span>
                    )}
                  </div>

                  {livePastedStats.incItems.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800 text-[11px]">
                      <span className="text-amber-400 font-semibold block">
                        Incidencias señaladas para corregir:
                      </span>
                      {livePastedStats.incItems.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="text-slate-300 font-mono flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                          <span className="truncate max-w-sm font-bold text-white">{item.description}</span>
                          <span className="text-amber-400 font-semibold">{item.incidences[0]?.message}</span>
                        </div>
                      ))}
                      {livePastedStats.incItems.length > 3 && (
                        <span className="text-[10px] text-slate-400 italic block">
                          ... y {livePastedStats.incItems.length - 3} incidencias adicionales.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleParsePasted}
                disabled={!pastedText.trim()}
                className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/30 transition-all disabled:opacity-50"
              >
                Cargar en Tabla Interactiva para Revisión
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Zona de Revisión de Incidencias y Configuración de Sesión */
        <div className="space-y-6">
          {/* Tarjetas de Métricas de Importación */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 shadow-lg">
              <span className="text-xs text-slate-400 font-semibold block">Total Artículos</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-white mt-1 block font-mono">
                {totalCount}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Filas leídas en archivo</span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 shadow-lg">
              <span className="text-xs text-slate-400 font-semibold block">Incidencias para Corregir</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-2xl sm:text-3xl font-extrabold font-mono ${
                    totalIncidencias > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {totalIncidencias}
                </span>
                <span className="text-xs text-slate-400">
                  ({Math.round(((totalCount - totalIncidencias) / totalCount) * 100)}% interpretados)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {totalIncidencias > 0
                  ? 'Requieren revisión de factor'
                  : 'Todos los factores detectados'}
              </span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 shadow-lg">
              <span className="text-xs text-slate-400 font-semibold block">Unidades y Fracciones</span>
              <div className="text-sm font-bold text-cyan-300 mt-1.5 flex items-center gap-2">
                <span>{totalPacks} Unidades (u)</span>
                <span className="text-slate-400">•</span>
                <span>{totalLoose} Fracciones (f)</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Desglose de inventario del sistema</span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 shadow-lg">
              <span className="text-xs text-slate-400 font-semibold block">Total Fracciones Base</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1 block font-mono">
                {totalCalculatedUnits.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Fracciones teóricas calculadas</span>
            </div>
          </div>

          {/* Configuración de Sesión Destino */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              Destino en la Base de Datos
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">Modo de Carga</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="radio"
                      name="targetMode"
                      checked={targetMode === 'new'}
                      onChange={() => setTargetMode('new')}
                      className="accent-cyan-500"
                    />
                    <span>Crear Nueva Sesión</span>
                  </label>
                  {existingSessions.length > 0 && (
                    <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="targetMode"
                        checked={targetMode === 'existing'}
                        onChange={() => setTargetMode('existing')}
                        className="accent-cyan-500"
                      />
                      <span>Agregar a Sesión Existente</span>
                    </label>
                  )}
                </div>
              </div>

              {targetMode === 'new' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Título de la Sesión</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Auditor / Responsable</label>
                    <input
                      type="text"
                      value={auditorName}
                      onChange={(e) => setAuditorName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-slate-400 block mb-1">Modalidad de Destino</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSessionDestination('formal')}
                        className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                          sessionDestination === 'formal'
                            ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        🎯 Conteo Formal (Escáner & Reconteos)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSessionDestination('quick')}
                        className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                          sessionDestination === 'quick'
                            ? 'bg-amber-500/30 border-amber-500 text-amber-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚡ Inventario Rápido (Móvil & Muestreo)
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs">
                  <label className="text-slate-400 block mb-1">Selecciona la Sesión Activa</label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-500"
                  >
                    {existingSessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Barra de Filtros de la Tabla de Revisión */}
          <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                  filterMode === 'all'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white'
                }`}
              >
                Todos ({items.length})
              </button>

              <button
                onClick={() => setFilterMode('incidences')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                  filterMode === 'incidences'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'bg-slate-900/60 text-amber-400 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Sólo Incidencias ({totalIncidencias})</span>
              </button>

              <button
                onClick={() => setFilterMode('valid')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                  filterMode === 'valid'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-slate-900/60 text-emerald-400 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Correctos ({items.length - totalIncidencias})</span>
              </button>

              {totalIncidencias > 0 && (
                <button
                  onClick={handleAutoResolveNoFactor}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors ml-2"
                  title="Asigna factor 1 a todos los artículos donde no se detectó empaque en el nombre"
                >
                  Asignar Factor 1 a Incidencias
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar dinámicamente por nombre, SKU o incidencia..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white outline-none focus:border-cyan-500 placeholder:text-slate-400"
                />
                {searchFilter && (
                  <button
                    onClick={() => setSearchFilter('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                onClick={() => setItems([])}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-rose-400 bg-slate-900/40 border border-slate-700/60"
              >
                Limpiar
              </button>
            </div>
          </div>

          {/* Banner de búsqueda dinámica en vivo */}
          {searchFilter.trim() && (
            <div className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-slate-300">
                  Mostrando <b className="text-white">{filteredList.length}</b> artículos coincidentes con "
                  <span className="text-cyan-300 font-mono">{searchFilter}</span>"
                </span>
                {incidencesInSearch > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {incidencesInSearch} con incidencias
                  </span>
                )}
              </div>

              {incidencesInSearch > 0 && filterMode !== 'incidences' && (
                <button
                  onClick={() => setFilterMode('incidences')}
                  className="text-xs text-amber-400 hover:text-amber-300 underline font-semibold self-start sm:self-auto"
                >
                  Filtrar sólo las {incidencesInSearch} incidencias de esta búsqueda
                </button>
              )}
            </div>
          )}

          {/* Tabla Interactiva de Corrección */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-700 text-slate-400 uppercase font-semibold text-[11px] tracking-wider z-10">
                  <tr>
                    <th className="px-3 py-3 w-10 text-center">#</th>
                    <th className="px-3 py-3">ID / SKU</th>
                    <th className="px-3 py-3">Producto</th>
                    <th className="px-3 py-3 text-center">Stock Archivo</th>
                    <th className="px-3 py-3 text-center w-20">Unids (u)</th>
                    <th className="px-3 py-3 text-center w-20">Fracc (f)</th>
                    <th className="px-3 py-3 text-center w-24">Factor</th>
                    <th className="px-3 py-3 text-right">Stock Teórico</th>
                    <th className="px-3 py-3 text-right w-24">Valor Caja ($)</th>
                    <th className="px-3 py-3 text-right w-24">Costo Fracc ($)</th>
                    <th className="px-3 py-3 text-center">Estado / Incidencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        No hay artículos con el filtro aplicado.
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((item) => {
                      const hasWarning = item.incidences.some(
                        (i) => i.severity === 'warning' || i.severity === 'error'
                      );

                      return (
                        <tr
                          key={item.rowId}
                          className={`hover:bg-slate-700/30 transition-colors ${
                            hasWarning ? 'bg-amber-950/20' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 text-center text-slate-400 font-mono text-[10px]">
                            {item.rowId}
                          </td>

                          {/* ID / SKU */}
                          <td className="px-3 py-2.5 font-mono text-cyan-300 font-bold">
                            {item.sku}
                          </td>

                          {/* Producto */}
                          <td className="px-3 py-2.5">
                            <span className="font-semibold text-white block">
                              {item.description}
                            </span>
                            {item.incidences.length > 0 && (
                              <div className="space-y-0.5 mt-0.5">
                                {item.incidences.map((inc, idx) => (
                                  <span
                                    key={idx}
                                    className={`text-[10px] block font-medium ${
                                      inc.severity === 'warning'
                                        ? 'text-amber-400'
                                        : inc.severity === 'error'
                                        ? 'text-rose-400'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    • {inc.message}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Stock Original en Archivo */}
                          <td className="px-3 py-2.5 text-center font-mono text-slate-400 bg-slate-900/30">
                            {item.rawStock}
                          </td>

                          {/* Cajas (u) - Editable */}
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.packs}
                              onChange={(e) =>
                                handleUpdateItem(
                                  item.rowId,
                                  'packs',
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              className="w-16 bg-slate-900 border border-slate-700 rounded-lg py-1 px-1.5 text-center text-white font-mono text-xs focus:border-cyan-500 outline-none"
                            />
                          </td>

                          {/* Fracciones (f) - Editable */}
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.loose}
                              onChange={(e) =>
                                handleUpdateItem(
                                  item.rowId,
                                  'loose',
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              className="w-16 bg-slate-900 border border-slate-700 rounded-lg py-1 px-1.5 text-center text-white font-mono text-xs focus:border-cyan-500 outline-none"
                            />
                          </td>

                          {/* Factor de Empaque - Editable con Feedback */}
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-[10px] text-slate-400 font-mono">1x</span>
                              <input
                                type="number"
                                min="1"
                                value={item.factor}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    item.rowId,
                                    'factor',
                                    parseInt(e.target.value, 10) || 1
                                  )
                                }
                                className={`w-16 bg-slate-900 border rounded-lg py-1 px-1.5 text-center font-mono text-xs font-bold outline-none ${
                                  hasWarning
                                    ? 'border-amber-500 text-amber-300 ring-2 ring-amber-500/20'
                                    : 'border-slate-700 text-cyan-300 focus:border-cyan-500'
                                }`}
                              />
                            </div>
                          </td>

                          {/* Stock Teórico Calculado */}
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-400 text-xs">
                            {item.calculatedStock} fracc.
                          </td>

                          {/* Valor Caja ($) - Editable */}
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.boxCost > 0 ? item.boxCost : ''}
                              placeholder="0.00"
                              onChange={(e) =>
                                handleUpdateItem(
                                  item.rowId,
                                  'boxCost',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-20 bg-slate-900 border border-slate-700 rounded-lg py-1 px-1.5 text-right text-emerald-400 font-mono text-xs focus:border-cyan-500 outline-none"
                            />
                          </td>

                          {/* Costo Fracción ($) - Calculado Automáticamente */}
                          <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-slate-300">
                            ${Number(item.unitCostCalculated || 0).toFixed(4)}
                          </td>

                          {/* Badge de Estado */}
                          <td className="px-3 py-2.5 text-center">
                            {hasWarning ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                <AlertTriangle className="w-3 h-3" />
                                Incidencia
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                Correcto
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botón de Confirmación e Importación */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div>
              <span className="text-white font-bold text-sm block">
                ¿Todo listo para cargar los datos en PostgreSQL?
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                Se insertarán {items.length} artículos en la sesión "{targetMode === 'new' ? newTitle : 'existente'}".
              </p>
            </div>

            <button
              onClick={handleCommitImport}
              disabled={isImporting || items.length === 0}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{importStatus || 'Importando a la base de datos...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>CONFIRMAR E IMPORTAR {items.length} ARTÍCULOS</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
