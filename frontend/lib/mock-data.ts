export type Project = {
  id: number;
  customer: string;
  name: string;
  code: string;
  activeVersion: string;
  status: "Active" | "In Review" | "Quoting" | "Archived";
  customerValue: number;
  internalCost: number;
  critical: number;
  needsReview: number;
  lastUpdated: string;
};

export const projects: Project[] = [
  {
    id: 1,
    customer: "Elbit Systems",
    name: "Radar Control Board v3",
    code: "ELB-RCB-003",
    activeVersion: "v3.0",
    status: "In Review",
    customerValue: 412000,
    internalCost: 287400,
    critical: 2,
    needsReview: 5,
    lastUpdated: "2026-06-13",
  },
  {
    id: 2,
    customer: "Rafael",
    name: "UAV Power Distribution",
    code: "RAF-UPD-011",
    activeVersion: "v1.4",
    status: "Active",
    customerValue: 268500,
    internalCost: 171200,
    critical: 0,
    needsReview: 1,
    lastUpdated: "2026-06-12",
  },
  {
    id: 3,
    customer: "IAI",
    name: "Satellite Comm Module",
    code: "IAI-SCM-007",
    activeVersion: "v2.1",
    status: "Quoting",
    customerValue: 540300,
    internalCost: 392000,
    critical: 1,
    needsReview: 3,
    lastUpdated: "2026-06-10",
  },
  {
    id: 4,
    customer: "Plasan",
    name: "Vehicle Telemetry Unit",
    code: "PLS-VTU-022",
    activeVersion: "v1.0",
    status: "Archived",
    customerValue: 96200,
    internalCost: 71800,
    critical: 0,
    needsReview: 0,
    lastUpdated: "2026-05-28",
  },
];

export type BomLine = {
  lineNo: number;
  mpn: string;
  manufacturer: string;
  description: string;
  qty: number;
  unit: string;
  internalCost: number;
  customerPrice: number;
  critical: boolean;
};

export const bomLines: BomLine[] = [
  { lineNo: 1, mpn: "STM32F407VGT6", manufacturer: "STMicro", description: "MCU 168MHz ARM Cortex-M4", qty: 1, unit: "pcs", internalCost: 11.4, customerPrice: 16.8, critical: true },
  { lineNo: 2, mpn: "LM2596S-5.0", manufacturer: "TI", description: "Buck regulator 3A 5V", qty: 2, unit: "pcs", internalCost: 1.85, customerPrice: 2.9, critical: false },
  { lineNo: 3, mpn: "GRM188R71H104KA93D", manufacturer: "Murata", description: "Cap 0.1uF 50V X7R 0603", qty: 48, unit: "pcs", internalCost: 0.012, customerPrice: 0.03, critical: false },
  { lineNo: 4, mpn: "ADXL345BCCZ", manufacturer: "Analog Devices", description: "Accelerometer 3-axis I2C/SPI", qty: 1, unit: "pcs", internalCost: 4.2, customerPrice: 6.5, critical: true },
  { lineNo: 5, mpn: "TPS54331DR", manufacturer: "TI", description: "Step-down converter 3A", qty: 1, unit: "pcs", internalCost: 0.95, customerPrice: 1.6, critical: false },
];

export type ActivityEntry = {
  id: number;
  user: string;
  actionType: string;
  project: string;
  entityType: string;
  entityName: string;
  summary: string;
  at: string;
};

export const activity: ActivityEntry[] = [
  { id: 1, user: "Yaniv Botvinik", actionType: "project.create", project: "Radar Control Board v3", entityType: "project", entityName: "ELB-RCB-003", summary: "יצירת פרויקט חדש", at: "2026-06-13 09:12" },
  { id: 2, user: "Diana", actionType: "bom_version.create", project: "Radar Control Board v3", entityType: "bom_version", entityName: "v3.0", summary: "העלאת גרסת BOM חדשה", at: "2026-06-13 10:01" },
  { id: 3, user: "Yossi Cohen", actionType: "bom_line.update", project: "Radar Control Board v3", entityType: "bom_line", entityName: "STM32F407VGT6", summary: "עדכון Internal Cost", at: "2026-06-13 11:25" },
  { id: 4, user: "Diana", actionType: "pricing.snapshot", project: "Satellite Comm Module", entityType: "pricing_snapshot", entityName: "Q2-2026", summary: "יצירת Pricing Snapshot", at: "2026-06-12 14:40" },
];
