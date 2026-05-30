import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import Papa from "papaparse";
import * as THREE from "three";

import {
  FULL_DATASET_POINT_COUNT,
  getDeviceMode,
  limitPointsForDevice,
  type DeviceMode,
} from "../utils/devicePerformance";

export type PointColorMode = "raw" | "local";
export type GenderOption = "woman" | "man";
export type TimePeriodFilter =
  | "before1800"
  | "1800to1849"
  | "1850to1899"
  | "1900to1949"
  | "1950plus"
  | "unknown";

export type BucketFilterOption = {
  bucketId: string;
  displayName: string;
  bucketLean: string;
  topTerms: string[];
};

export type PointFilters = {
  search: string;
  genders: GenderOption[];
  timePeriods: TimePeriodFilter[];
  fields: string[];
  careers: string[];
  buckets: string[];
};

export type FilterOptions = {
  fieldOptions: string[];
  careerOptions: string[];
  bucketOptions: BucketFilterOption[];
};

export type LatentLoadProgress = {
  loaded: number;
  total: number;
  phase: string;
  isReady: boolean;
};

type LatentIntroProps = {
  isEntered: boolean;
  isHomeIntroReady: boolean;
  pointColorMode: PointColorMode;
  filters: PointFilters;
  onFilterOptionsChange?: (options: FilterOptions) => void;
  onVisibleCountChange?: (visibleCount: number, totalCount: number) => void;
  onSelectedPointChange?: (isSelected: boolean) => void;
  onLoadProgressChange?: (progress: LatentLoadProgress) => void;
  onLatentReadyChange?: (isReady: boolean) => void;
  uiShellRef?: RefObject<HTMLDivElement | null>;
};

type CsvPoint = {
  bio_id: string;
  name: string;
  gender_label: string;
  birth_year: string;
  death_year: string;
  source_type: string;
  source_name: string;
  source_url: string;
  field_bucket: string;
  career_type: string;
  primary_field: string;
  primary_role: string;
  word_count: string;
  text_masked: string;
  text_raw?: string;
  raw_text?: string;
  text_clean?: string;
  full_text?: string;
  biography_text?: string;
  text?: string;
  x: string;
  y: string;
  z: string;
  local_woman_share: string;
};

type ExplanationCsvRow = {
  bio_id: string;
  name: string;
  gender_label: string;
  predicted_gender_pattern_strict: string;
  prob_woman_pattern_strict: string;
  top_phrases_pushing_woman_strict: string;
  top_phrases_pushing_man_strict: string;
  data_driven_buckets_in_bio: string;
  field_bucket: string;
  career_type: string;
  primary_field: string;
  primary_role: string;
  birth_year: string;
  word_count: string;
  text_masked: string;
  text_raw?: string;
  raw_text?: string;
  text_clean?: string;
  full_text?: string;
  biography_text?: string;
  text?: string;
};

type PointFramesCsvRow = {
  bio_id: string;
  gender_label: string;
  local_woman_share: string;
  predicted_map_lean: string;
  matches_gender_label: string;
  lean_reason: string;
  strongest_frames: string;
  strongest_frames_json: string;
  similar_profiles: string;
  similar_profiles_json: string;
};

type FrameDefinitionCsvRow = {
  frame_id: string;
  label: string;
  side: string;
  description: string;
  seed_phrases: string;
};

type FrameSide = "woman" | "man" | "unknown";

type FrameDefinition = {
  frameId: string;
  label: string;
  side: FrameSide;
  description: string;
  seedPhrases: string[];
};

type DataDrivenBucket = {
  bucketId: string;
  displayName: string;
  bucketLean: string;
  weightedWomanShare: number | null;
  datasetWomanShare: number | null;
  differenceFromBaseline: number | null;
  weightedProbWomanPattern: number | null;
  topTerms: string[];
  description?: string;
  evidence?: string[];
  score?: number | null;
  frameSide?: FrameSide;
};

type SimilarProfile = {
  bioId?: string;
  name: string;
  genderLabel?: string;
  score?: number | null;
  note?: string;
};

type PointFrameInfo = {
  bioId: string;
  predictedMapLean: string;
  matchesGenderLabel?: boolean;
  leanReason: string;
  frames: DataDrivenBucket[];
  similarProfiles: SimilarProfile[];
};

type PointExplanation = {
  bioId: string;
  predictedGenderPatternStrict: string;
  probWomanPatternStrict: number | null;
  topPhrasesPushingWomanStrict: string[];
  topPhrasesPushingManStrict: string[];
  bucketIds: string[];
  textMasked: string;
  wordCount?: number;
};

type BioPoint = {
  bioId: string;
  name: string;
  genderLabel: string;
  birthYear?: number;
  deathYear?: number;
  sourceType: string;
  sourceName: string;
  sourceUrl: string;
  fieldBucket: string;
  careerType: string;
  primaryField: string;
  primaryRole: string;
  wordCount?: number;
  textMasked: string;
  x: number;
  y: number;
  z: number;
  localWomanShare: number;
  explanation?: PointExplanation;
  bucketIds: string[];
  bucketsInBio: DataDrivenBucket[];
  frameInfo?: PointFrameInfo;
};

type SelectedBioPoint = {
  point: BioPoint;
  scenePosition: THREE.Vector3;
};

type HoveredBioPoint = {
  index: number;
  localPosition: [number, number, number];
  color: string;
};

type LayoutScale = {
  centerX: number;
  centerY: number;
  centerZ: number;
  sceneScale: number;
};

type DeviceNotice = {
  reason: string;
  displayedPoints: number;
  totalPoints: number;
};

type SelectedCirclePanel =
  | "summary"
  | "pattern"
  | "dates"
  | "source"
  | "field"
  | "career"
  | "text";

type SelectedCircleStyle = CSSProperties & {
  "--selected-accent": string;
  "--selected-ring": string;
};

type ExploredLocalInfo = {
  womanPercent: number;
  manPercent: number;
  neighborCount: number;
  exploredSetSize: number;
  k: number;
};

type ExploredLocalShare = {
  womanShare: number;
  neighborCount: number;
};

type ExploredLocalShareMap = Map<string, ExploredLocalShare>;

type NeighborSearchNode = {
  point: BioPoint;
  axis: 0 | 1 | 2;
  left: NeighborSearchNode | null;
  right: NeighborSearchNode | null;
};

function publicAssetPath(relativePath: string): string {
  const baseUrl = import.meta.env.BASE_URL || "/";
  return `${baseUrl.replace(/\/?$/, "/")}${relativePath.replace(/^\//, "")}`;
}

function csvCandidates(fileStem: string, preferMobile = false): string[] {
  const stems = preferMobile
    ? [`${fileStem}_mobile`, fileStem]
    : [fileStem];

  return stems.flatMap((stem) =>
    [
      `data/${stem}.csv.gz`,
      `data/${stem}.csv`,
    ].map(publicAssetPath)
  );
}

function pointCsvPathsForDevice(deviceMode: DeviceMode): string[] {
  if (deviceMode.isLimitedDevice) {
    return [
      "data/mpnet_local_3d_website_points_mobile.csv.gz",
      "data/mpnet_local_3d_website_points_mobile.csv",
    ].map(publicAssetPath);
  }

  return csvCandidates("mpnet_local_3d_website_points");
}

const EXPLANATIONS_PATHS = csvCandidates("point_explanations_data_driven_buckets");
const POINT_FRAMES_PATHS = csvCandidates("point_frames_and_similar_profiles");
const FRAME_DEFINITIONS_PATHS = csvCandidates("public_frame_definitions");

function toNumber(value: string | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function cleanFilterText(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizeCsvHeader(header: string): string {
  return header.trim().replace(/^﻿/, "");
}

function getUniqueOptions(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map(cleanFilterText)
        .filter((v) => v.length > 0)
        .filter((v) => !v.toLowerCase().startsWith("unknown"))
    )
  ).sort((a, b) => a.localeCompare(b));
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function termBlobIncludes(termBlob: string, candidates: string[]): boolean {
  return candidates.some((c) => termBlob.includes(c));
}

function makeBucketDisplayName(_bucketId: string, topTerms: string[], bucketLean = ""): string {
  const blob = topTerms.join(" ").toLowerCase();

  if (termBlobIncludes(blob, ["computer science", "computer scientist", "computing", "technology"])) return "Computer Science & Engineering";
  if (termBlobIncludes(blob, ["psychology", "psychologist", "psychological"])) return "Psychology & Social Science";
  if (termBlobIncludes(blob, ["mathematics", "mathematician", "geometry", "differential"])) return "Mathematics & Theory";
  if (termBlobIncludes(blob, ["physics", "physicist", "quantum", "nuclear", "chemistry"])) return "Physics, Chemistry & Labs";
  if (termBlobIncludes(blob, ["medical", "medicine", "physician", "hospital", "public health", "cancer"])) return "Medicine & Public Health";
  if (termBlobIncludes(blob, ["economics", "economist", "finance", "bank", "business", "management"])) return "Economics, Policy & Finance";
  if (termBlobIncludes(blob, ["politician", "minister", "parliament", "prime", "election", "government"])) return "Politics & Government";
  if (termBlobIncludes(blob, ["national academy", "academy sciences", "academy arts", "elected", "society"])) return "Scientific Academies & Honors";
  if (termBlobIncludes(blob, ["historian", "writer", "books", "author", "published", "wrote"])) return "Historical Writing & Authors";
  if (termBlobIncludes(blob, ["political science", "department", "faculty", "professor", "studies"])) return "University & Political Science";
  if (termBlobIncludes(blob, ["new york", "united states", "york city", "college"])) return "New York & U.S. Institutions";
  if (termBlobIncludes(blob, ["british", "london", "royal society", "oxford", "cambridge"])) return "British Academic Institutions";
  if (termBlobIncludes(blob, ["german", "berlin", "germany", "world war", "war"])) return "German & Wartime Academia";
  if (termBlobIncludes(blob, ["russian", "soviet", "moscow", "russia", "petersburg"])) return "Russian & Soviet Academia";
  if (termBlobIncludes(blob, ["indian", "india", "government india", "highest indian"])) return "Indian Science & Government";

  const meaningful = topTerms
    .filter((t) => t.length > 2)
    .filter((t) => !/^(and|the|of|in|for|to|with|born|known)$/i.test(t));

  if (meaningful.length > 0) return `${meaningful.slice(0, 2).map(toTitleCase).join(" & ")} Framing`;

  const leanName = cleanFilterText(bucketLean).replace("_", " ");
  return leanName ? `${toTitleCase(leanName)} Framing` : "Data-driven Framing";
}

function getBucketFilterOptions(points: BioPoint[]): BucketFilterOption[] {
  const map = new Map<string, BucketFilterOption>();

  points.forEach((point) => {
    point.bucketsInBio.forEach((b) => {
      if (!map.has(b.bucketId)) {
        map.set(b.bucketId, { bucketId: b.bucketId, displayName: b.displayName, bucketLean: b.bucketLean, topTerms: b.topTerms });
      }
    });
    point.bucketIds.forEach((id) => {
      if (!map.has(id)) {
        map.set(id, { bucketId: id, displayName: makeBucketDisplayName(id, [], "unknown"), bucketLean: "unknown", topTerms: [] });
      }
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const sideOrder = (s: string) => s === "man" ? 0 : s === "woman" ? 1 : 2;
    const diff = sideOrder(a.bucketLean) - sideOrder(b.bucketLean);
    return diff !== 0 ? diff : a.displayName.localeCompare(b.displayName);
  });
}

function getFilterOptions(points: BioPoint[]): FilterOptions {
  return {
    fieldOptions: getUniqueOptions(points.flatMap((p) => [p.fieldBucket, p.primaryField])),
    careerOptions: getUniqueOptions(points.flatMap((p) => [p.careerType, p.primaryRole])),
    bucketOptions: getBucketFilterOptions(points),
  };
}

function pointYearForFilter(point: BioPoint): number | undefined {
  return point.birthYear ?? point.deathYear;
}

function matchesSingleTimePeriod(point: BioPoint, tp: TimePeriodFilter): boolean {
  const year = pointYearForFilter(point);
  if (tp === "unknown") return year === undefined;
  if (year === undefined) return false;
  if (tp === "before1800") return year < 1800;
  if (tp === "1800to1849") return year >= 1800 && year <= 1849;
  if (tp === "1850to1899") return year >= 1850 && year <= 1899;
  if (tp === "1900to1949") return year >= 1900 && year <= 1949;
  if (tp === "1950plus") return year >= 1950;
  return true;
}

function matchesAnyTimePeriod(point: BioPoint, tps: TimePeriodFilter[]): boolean {
  if (tps.length === 0) return true;
  return tps.some((tp) => matchesSingleTimePeriod(point, tp));
}

function fieldMatches(point: BioPoint, fields: string[]): boolean {
  if (fields.length === 0) return true;
  const pf = [point.fieldBucket, point.primaryField].map(cleanFilterText);
  return fields.some((f) => pf.includes(cleanFilterText(f)));
}

function careerMatches(point: BioPoint, careers: string[]): boolean {
  if (careers.length === 0) return true;
  const pc = [point.careerType, point.primaryRole].map(cleanFilterText);
  return careers.some((c) => pc.includes(cleanFilterText(c)));
}

function bucketMatches(point: BioPoint, buckets: string[]): boolean {
  if (buckets.length === 0) return true;
  return buckets.some((b) => point.bucketIds.includes(cleanFilterText(b)));
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getSearchTokens(search: string): string[] {
  const matches = search.match(/"([^"]+)"|\S+/g) ?? [];
  return matches.map((t) => t.replace(/^"|"$/g, "").trim()).filter(Boolean).map(normalizeSearchText);
}

function searchMatches(point: BioPoint, search: string): boolean {
  const tokens = getSearchTokens(search);
  if (tokens.length === 0) return true;

  const bucketText = point.bucketsInBio.flatMap((b) => [b.bucketId, b.displayName, b.bucketLean, ...b.topTerms]).join(" ");
  const explanationText = point.explanation
    ? [point.explanation.predictedGenderPatternStrict, ...point.explanation.topPhrasesPushingWomanStrict, ...point.explanation.topPhrasesPushingManStrict].join(" ")
    : "";
  const frameText = point.frameInfo
    ? [
        point.frameInfo.predictedMapLean,
        point.frameInfo.leanReason,
        ...point.frameInfo.frames.flatMap((f) => [f.displayName, f.description ?? "", ...(f.evidence ?? []), ...f.topTerms]),
        ...point.frameInfo.similarProfiles.map((p) => [p.name, p.genderLabel ?? "", p.note ?? ""].join(" ")),
      ].join(" ")
    : "";

  const searchable = normalizeSearchText(
    [point.bioId, point.name, point.genderLabel, point.birthYear?.toString(), point.deathYear?.toString(),
     point.sourceType, point.sourceName, point.sourceUrl, point.fieldBucket, point.careerType,
     point.primaryField, point.primaryRole, point.wordCount?.toString(), point.textMasked,
     point.bucketIds.join(" "), bucketText, explanationText, frameText].filter(Boolean).join(" ")
  );

  return tokens.every((t) => searchable.includes(t));
}

function pointMatchesFilters(point: BioPoint, filters: PointFilters): boolean {
  const g = point.genderLabel.toLowerCase().trim();
  if (filters.genders.length > 0 && !filters.genders.includes(g as GenderOption)) return false;
  return (
    matchesAnyTimePeriod(point, filters.timePeriods) &&
    fieldMatches(point, filters.fields) &&
    careerMatches(point, filters.careers) &&
    bucketMatches(point, filters.buckets) &&
    searchMatches(point, filters.search)
  );
}

function getLayoutScale(points: BioPoint[]): LayoutScale | null {
  if (points.length === 0) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const zs = points.map((p) => p.z);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const maxRange = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1);

  return { centerX, centerY, centerZ, sceneScale: 6 / maxRange };
}

function parseDelimitedList(value: string | undefined): string[] {
  const trimmed = cleanFilterText(value);
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {}

  const without = trimmed.replace(/^\[/, "").replace(/\]$/, "").replace(/^"|"$/g, "");
  const delim = without.includes(";") ? ";" : without.includes("|") ? "|" : ",";
  return without.split(delim).map((item) => item.replace(/^['"]|['"]$/g, "").trim()).filter(Boolean);
}

function parseBucketIds(value: string | undefined): string[] {
  const matches = cleanFilterText(value).match(/bucket_\d+/g) ?? [];
  return Array.from(new Set(matches));
}

function normalizeFrameSide(value: string | undefined): FrameSide {
  const cleaned = cleanFilterText(value).toLowerCase();
  if (cleaned.includes("female") || cleaned.includes("woman")) return "woman";
  if (cleaned.includes("male") || cleaned.includes("man")) return "man";
  return "unknown";
}

function parseMaybeJson(value: string | undefined): unknown | null {
  const trimmed = cleanFilterText(value);
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return JSON.parse(trimmed.replace(/\bNone\b/g, "null").replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/'/g, '"'));
    } catch {
      return null;
    }
  }
}

function flattenFrameJson(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(flattenFrameJson);

  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const hasFrameShape = "frame_id" in rec || "frameId" in rec || "public_frame_id" in rec ||
      "frame_label" in rec || "frame_name" in rec || "id" in rec || "label" in rec ||
      "side" in rec || "score" in rec || "evidence" in rec || "phrases" in rec ||
      "matches" in rec;
    if (hasFrameShape) return [rec];
    return Object.values(rec).flatMap(flattenFrameJson);
  }

  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function asStringArray(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap((item) => asStringArray(item)).map((item) => cleanDisplayValue(item)).filter(Boolean);
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const likely = rec.phrase ?? rec.text ?? rec.name ?? rec.label ?? rec.value;
    return likely ? [cleanDisplayValue(String(likely))].filter(Boolean) : [];
  }
  return parseDelimitedList(String(value));
}

function frameFallbackLabel(frameId: string): string {
  return toTitleCase(frameId.replace(/^frame[_-]?/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Frame");
}

function createFrameDefinition(row: FrameDefinitionCsvRow): FrameDefinition | null {
  const frameId = cleanFilterText(row.frame_id);
  if (!frameId) return null;
  return {
    frameId,
    label: cleanFilterText(row.label) || frameFallbackLabel(frameId),
    side: normalizeFrameSide(row.side),
    description: cleanFilterText(row.description),
    seedPhrases: parseDelimitedList(row.seed_phrases),
  };
}

function normalizeFrameLookupValue(value: string): string {
  return normalizeSearchText(value)
    .replace(/\bframe\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findFrameDefinitionByLooseName(rawValue: string, defs: Map<string, FrameDefinition>): FrameDefinition | undefined {
  const cleaned = normalizeFrameLookupValue(rawValue);
  if (!cleaned) return undefined;
  const unique = Array.from(new Set(defs.values()));
  return unique.find((d) => {
    const id = normalizeFrameLookupValue(d.frameId);
    const label = normalizeFrameLookupValue(d.label);
    return id === cleaned || label === cleaned || cleaned.includes(id) || cleaned.includes(label) || id.includes(cleaned) || label.includes(cleaned);
  });
}

function frameFromUnknownItem(item: unknown, defs: Map<string, FrameDefinition>): DataDrivenBucket | null {
  const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null;
  const rawString = record ? "" : cleanFilterText(String(item ?? ""));

  const rawFrameId = record
    ? String(record.frame_id ?? record.frameId ?? record.public_frame_id ?? record.id ?? record.frame ?? record.bucket_id ?? "")
    : rawString.split(/\s*[|:]\s*/)[0] ?? rawString;

  const rawLabel = record
    ? String(record.label ?? record.frame_label ?? record.frame_name ?? record.name ?? record.title ?? "")
    : "";

  const frameDef =
    defs.get(cleanFilterText(rawFrameId)) ??
    defs.get(normalizeFrameLookupValue(rawFrameId)) ??
    (rawLabel ? defs.get(normalizeFrameLookupValue(rawLabel)) : undefined) ??
    (rawLabel ? findFrameDefinitionByLooseName(rawLabel, defs) : undefined) ??
    (rawFrameId ? findFrameDefinitionByLooseName(rawFrameId, defs) : undefined) ??
    (rawString ? findFrameDefinitionByLooseName(rawString, defs) : undefined);

  const frameId = frameDef?.frameId || cleanFilterText(rawFrameId) || cleanFilterText(rawLabel);
  if (!frameId) return null;

  const side = normalizeFrameSide(
    record
      ? String(record.side ?? record.frame_side ?? record.side_label ?? record.bucket_lean ?? record.lean ?? record.direction ?? frameDef?.side ?? "")
      : frameDef?.side
  );

  const recordEvidence = record
    ? [
        ...asStringArray(record.evidence), ...asStringArray(record.evidence_text),
        ...asStringArray(record.evidence_phrases), ...asStringArray(record.matched_phrases),
        ...asStringArray(record.matched_terms), ...asStringArray(record.contributing_phrases),
        ...asStringArray(record.representative_phrases), ...asStringArray(record.matches),
        ...asStringArray(record.phrases), ...asStringArray(record.examples),
        ...asStringArray(record.terms), ...asStringArray(record.seed_phrases),
      ]
    : rawString.includes("|") || rawString.includes(":")
      ? rawString.split(/\s*[|:]\s*/).slice(1).flatMap((p) => parseDelimitedList(p))
      : [];

  const uniqueEvidence = Array.from(new Set(
    (recordEvidence.length > 0 ? recordEvidence : frameDef?.seedPhrases ?? [])
      .filter(Boolean)
      .filter((p) => !/^[+-]?\d+(?:\.\d+)?$/.test(p.trim()))
  ));

  const scoreValue = record
    ? toNumber(String(record.score ?? record.signed_score ?? record.effect ?? record.weight ?? record.contribution ?? record.contribution_score ?? record.frame_score ?? record.value ?? record.axis_value ?? ""))
    : (() => { const m = rawString.match(/[+-]?\d+(?:\.\d+)?/); return m ? toNumber(m[0]) : null; })();

  return {
    bucketId: frameId,
    displayName: cleanFilterText(rawLabel) || frameDef?.label || frameFallbackLabel(frameId),
    bucketLean: side,
    weightedWomanShare: null,
    datasetWomanShare: null,
    differenceFromBaseline: scoreValue,
    weightedProbWomanPattern: null,
    topTerms: uniqueEvidence,
    description: record
      ? cleanFilterText(String(record.description ?? record.note ?? frameDef?.description ?? ""))
      : frameDef?.description ?? "",
    evidence: uniqueEvidence,
    score: scoreValue,
    frameSide: side,
  };
}

function parseStrongestFrames(row: PointFramesCsvRow, defs: Map<string, FrameDefinition>): DataDrivenBucket[] {
  const parsedJson = parseMaybeJson(row.strongest_frames_json);
  const jsonItems = flattenFrameJson(parsedJson);
  const fallbackItems = jsonItems.length > 0 ? [] : parseDelimitedList(row.strongest_frames);

  const frameMap = new Map<string, DataDrivenBucket>();

  [...jsonItems, ...fallbackItems].forEach((item) => {
    const frame = frameFromUnknownItem(item, defs);
    if (frame) {
      const existing = frameMap.get(frame.bucketId);
      frameMap.set(frame.bucketId, existing
        ? { ...existing, ...frame, topTerms: Array.from(new Set([...existing.topTerms, ...frame.topTerms])), evidence: Array.from(new Set([...(existing.evidence ?? []), ...(frame.evidence ?? [])])) }
        : frame
      );
    }
  });

  return Array.from(frameMap.values());
}

function flattenProfileJson(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(flattenProfileJson);
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const hasProfileShape = "bio_id" in rec || "bioId" in rec || "id" in rec || "name" in rec ||
      "person_name" in rec || "profile_name" in rec || "label" in rec || "gender_label" in rec ||
      "gender" in rec || "similarity" in rec || "score" in rec;
    if (hasProfileShape) return [rec];
    return Object.values(rec).flatMap(flattenProfileJson);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function cleanSimilarProfileName(value: string): string {
  return cleanDisplayValue(value)
    .replace(/^name\s*[:=]\s*/i, "")
    .replace(/\s*\([+-]?\d+(?:\.\d+)?\)\s*$/g, "")
    .replace(/\s+[+-]?\d+(?:\.\d+)?\s*$/g, "")
    .trim();
}

function parseSimilarProfiles(value: string | undefined): SimilarProfile[] {
  const parsedJson = parseMaybeJson(value);
  const rawItems = parsedJson !== null ? flattenProfileJson(parsedJson) : parseDelimitedList(value);

  return rawItems
    .map((item): SimilarProfile | null => {
      if (typeof item === "string") {
        const parts = item.split(/\s*[|:]+\s*/).map((p) => p.trim()).filter(Boolean);
        const possibleBioId = parts.find((p) => /^bio[_-]?/i.test(p) || /^P\d+/i.test(p));
        const possibleGender = parts.find((p) => /^(wo)?man$|^female$|^male$/i.test(p));
        const possibleScore = parts.map((p) => toNumber(p)).find((n) => n !== null);
        const namePart = parts.find((p) => p !== possibleBioId && p !== possibleGender && toNumber(p) === null) ?? item;
        const name = cleanSimilarProfileName(namePart);
        return name ? { bioId: possibleBioId ? cleanFilterText(possibleBioId) : undefined, name, genderLabel: possibleGender ? cleanDisplayValue(possibleGender) : undefined, score: possibleScore ?? undefined } : null;
      }

      if (typeof item !== "object" || item === null) return null;
      const rec = item as Record<string, unknown>;
      const name = cleanSimilarProfileName(String(rec.name ?? rec.person_name ?? rec.profile_name ?? rec.similar_name ?? rec.similar_profile ?? rec.neighbor_name ?? rec.neighbour_name ?? rec.matched_name ?? rec.target_name ?? rec.label ?? rec.title ?? rec.bio_id ?? rec.bioId ?? ""));
      if (!name) return null;

      return {
        bioId: cleanFilterText(String(rec.bio_id ?? rec.bioId ?? rec.similar_bio_id ?? rec.neighbor_bio_id ?? rec.neighbour_bio_id ?? rec.matched_bio_id ?? rec.target_bio_id ?? rec.person_id ?? rec.id ?? rec.profile_id ?? "")) || undefined,
        name,
        genderLabel: cleanDisplayValue(String(rec.gender_label ?? rec.gender ?? rec.sex_label ?? "")) || undefined,
        score: toNumber(String(rec.score ?? rec.similarity ?? rec.similarity_score ?? rec.distance ?? rec.value ?? "")),
        note: cleanDisplayValue(String(rec.note ?? rec.reason ?? rec.match_reason ?? rec.shared_frames ?? "")) || undefined,
      };
    })
    .filter((p): p is SimilarProfile => p !== null)
    .filter((p, i, arr) => {
      const key = `${cleanFilterText(p.bioId ?? "").toLowerCase()}|${normalizePersonName(p.name)}`;
      return arr.findIndex((c) => `${cleanFilterText(c.bioId ?? "").toLowerCase()}|${normalizePersonName(c.name)}` === key) === i;
    });
}

function createPointFrameInfo(row: PointFramesCsvRow, defs: Map<string, FrameDefinition>): PointFrameInfo | null {
  const bioId = cleanFilterText(row.bio_id);
  if (!bioId) return null;
  return {
    bioId,
    predictedMapLean: cleanDisplayValue(row.predicted_map_lean),
    matchesGenderLabel: cleanFilterText(row.matches_gender_label).toLowerCase() === "true",
    leanReason: cleanFilterText(row.lean_reason),
    frames: parseStrongestFrames(row, defs),
    similarProfiles: parseSimilarProfiles(row.similar_profiles_json).length > 0
      ? parseSimilarProfiles(row.similar_profiles_json)
      : parseSimilarProfiles(row.similar_profiles),
  };
}

function createExplanation(row: ExplanationCsvRow): PointExplanation | null {
  const bioId = cleanFilterText(row.bio_id);
  if (!bioId) return null;
  return {
    bioId,
    predictedGenderPatternStrict: cleanFilterText(row.predicted_gender_pattern_strict) || "Unknown pattern",
    probWomanPatternStrict: toNumber(row.prob_woman_pattern_strict),
    topPhrasesPushingWomanStrict: parseDelimitedList(row.top_phrases_pushing_woman_strict),
    topPhrasesPushingManStrict: parseDelimitedList(row.top_phrases_pushing_man_strict),
    bucketIds: parseBucketIds(row.data_driven_buckets_in_bio),
    textMasked: firstNonEmptyText(row.text_raw, row.raw_text, row.full_text, row.biography_text, row.text, row.text_clean, row.text_masked),
    wordCount: toNumber(row.word_count) ?? undefined,
  };
}

function firstNonEmptyText(...values: Array<string | undefined>): string {
  for (const v of values) {
    const c = typeof v === "string" ? v.trim() : "";
    if (c) return c;
  }
  return "";
}

function getFullBiographyText(row: CsvPoint, explanation?: PointExplanation): string {
  return firstNonEmptyText(row.text_raw, row.raw_text, row.full_text, row.biography_text, row.text, row.text_clean, explanation?.textMasked, row.text_masked);
}

function colorToHex(color: THREE.Color): string {
  return `#${color.getHexString()}`;
}

function createCircleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture(canvas);
  ctx.clearRect(0, 0, 64, 64);
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "white";
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createPulseRingTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture(canvas);
  ctx.clearRect(0, 0, 96, 96);
  ctx.beginPath();
  ctx.arc(48, 48, 31, 0, Math.PI * 2);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(48, 48, 42, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 3;
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function CameraIntro({
  isEntered,
  isHomeIntroReady,
}: {
  isEntered: boolean;
  isHomeIntroReady: boolean;
}) {
  const { camera } = useThree();
  const progressRef = useRef(0);

  useEffect(() => {
    if (!isEntered && isHomeIntroReady) {
      progressRef.current = 0;
      camera.position.set(-0.95, 0.95, 2.85);
      camera.lookAt(0, 0, 0);
    }
  }, [camera, isEntered, isHomeIntroReady]);

  useFrame((_, delta) => {
    if (isEntered || !isHomeIntroReady) return;

    // Start close to the points, then slowly pull back while orbiting.
    progressRef.current = Math.min(progressRef.current + delta * 0.105, 1);
    const t = 1 - Math.pow(1 - progressRef.current, 3);
    const angle = THREE.MathUtils.lerp(-0.38, 0.72, t);
    const radius = THREE.MathUtils.lerp(2.85, 8.35, t);
    const height = THREE.MathUtils.lerp(0.95, 3.05, t);

    camera.position.set(
      Math.sin(angle) * radius,
      height,
      Math.cos(angle) * radius
    );
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function getStrongLocalColor(value: number) {
  const manColor = new THREE.Color("#0057d9");
  const neutralColor = new THREE.Color("#c7ceda");
  const womanColor = new THREE.Color("#d61f8c");
  const v = clamp01(value);
  if (v === 0.5) return neutralColor.clone();
  const strength = Math.pow(Math.abs(v - 0.5) * 2, 0.35);
  return v < 0.5
    ? new THREE.Color().lerpColors(neutralColor, manColor, strength)
    : new THREE.Color().lerpColors(neutralColor, womanColor, strength);
}

function getRawGenderColor(genderLabel: string) {
  const g = genderLabel.toLowerCase().trim();
  if (g === "woman") return new THREE.Color("#d61f8c");
  if (g === "man") return new THREE.Color("#0057d9");
  return new THREE.Color("#697386");
}

function FocusCamera({
  selectedPoint,
  controlsRef,
  enabled = false,
}: {
  selectedPoint: SelectedBioPoint | null;
  controlsRef: RefObject<any>;
  enabled?: boolean;
}) {
  const { camera } = useThree();
  const desiredCameraRef = useRef<THREE.Vector3 | null>(null);
  const desiredTargetRef = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    // Keep the user's explored map position stable by default.
    // When enabled is false, selecting a point opens the explanation panel
    // without moving/zooming/re-centering the 3D space behind it.
    if (!enabled || !selectedPoint) {
      desiredCameraRef.current = null;
      desiredTargetRef.current = null;
      return;
    }

    const target = selectedPoint.scenePosition.clone();
    desiredTargetRef.current = target;
    desiredCameraRef.current = target.clone().add(new THREE.Vector3(0, 0.04, 4.75));
  }, [enabled, selectedPoint]);

  useFrame((_, delta) => {
    if (!enabled || !desiredCameraRef.current || !desiredTargetRef.current) return;

    const smooth = 1 - Math.pow(0.001, delta * 0.12);
    camera.position.lerp(desiredCameraRef.current, smooth);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(desiredTargetRef.current, smooth);
      controlsRef.current.update();
    } else {
      camera.lookAt(desiredTargetRef.current);
    }
  });

  return null;
}

function RaycasterSettings() {
  const { raycaster } = useThree();
  useEffect(() => {
    raycaster.params.Points = { threshold: 0.14 };
  }, [raycaster]);
  return null;
}

function LatentPointCloud({
  isEntered,
  isHomeIntroReady,
  points,
  layoutScale,
  pointColorMode,
  showPoints,
  isFading,
  isMapInteracting,
  exploredLocalShares,
  onSelectPoint,
}: {
  isEntered: boolean;
  isHomeIntroReady: boolean;
  points: BioPoint[];
  layoutScale: LayoutScale | null;
  pointColorMode: PointColorMode;
  showPoints: boolean;
  isFading: boolean;
  isMapInteracting: boolean;
  exploredLocalShares: ExploredLocalShareMap | null;
  onSelectPoint: (selected: SelectedBioPoint) => void;
}) {
  // FIX 1: Use a stable group for layout (no scale pulsing — that was shifting raycaster hits).
  // Pulsing is applied to material size only, keeping world positions accurate.
  const groupRef = useRef<THREE.Group>(null);
  const circleTexture = useMemo(() => createCircleTexture(), []);
  const pulseRingTexture = useMemo(() => createPulseRingTexture(), []);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const hoverPulseSpriteRef = useRef<THREE.Sprite>(null);
  const hoverPulseMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredBioPoint | null>(null);
  const hoveredIndexRef = useRef<number | null>(null);

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(points.length * 3);
    const col = new Float32Array(points.length * 3);

    if (points.length === 0 || !layoutScale) return { positions: pos, colors: col };

    const { centerX, centerY, centerZ, sceneScale } = layoutScale;

    points.forEach((point, i) => {
      pos[i * 3]     = (point.x - centerX) * sceneScale;
      pos[i * 3 + 1] = (point.z - centerZ) * sceneScale;
      pos[i * 3 + 2] = (point.y - centerY) * sceneScale;

      const recomputedLocalShare = exploredLocalShares?.get(point.bioId);
      const c = pointColorMode === "local"
        ? getStrongLocalColor(recomputedLocalShare?.womanShare ?? point.localWomanShare)
        : getRawGenderColor(point.genderLabel);

      col[i * 3]     = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    });

    return { positions: pos, colors: col };
  }, [points, pointColorMode, layoutScale, exploredLocalShares]);

  const elapsedRef = useRef(0);
  const pointClickStartRef = useRef<{ x: number; y: number; index: number } | null>(null);

  function clearHoveredPoint() {
    hoveredIndexRef.current = null;
    setHoveredPoint(null);
    if (typeof document !== "undefined") document.body.style.cursor = "";
  }

  useEffect(() => () => { if (typeof document !== "undefined") document.body.style.cursor = ""; }, []);
  useEffect(() => { clearHoveredPoint(); }, [points, pointColorMode, isFading, isMapInteracting]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    elapsedRef.current += delta;

    if (!isEntered && isHomeIntroReady) {
      // Home intro: rotate gently while the camera slowly pulls back.
      groupRef.current.rotation.y += delta * 0.18;
      groupRef.current.rotation.x = Math.sin(elapsedRef.current * 0.22) * 0.07;
    } else if (!isEntered) {
      groupRef.current.rotation.x = 0;
      groupRef.current.rotation.y = 0;
    } else {
      // Smoothly return group rotation to zero so OrbitControls inherits a clean
      // identity-rotation group. Without this, the accumulated intro rotation stays
      // baked into the group transform and OrbitControls orbits from a skewed origin,
      // making the view jump and the drag direction feel wrong.
      const smooth = 1 - Math.pow(0.001, delta * 2.5);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, smooth);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, smooth);
    }

    if (materialRef.current) {
      const targetOpacity = showPoints ? (isFading ? 0.05 : 1) : 0;
      const fadeSmooth = 1 - Math.pow(0.001, delta * 0.28);
      materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, targetOpacity, fadeSmooth);
      // Material size pulse — doesn't affect raycasting positions
      materialRef.current.size = 0.13 + Math.sin(elapsedRef.current * 1.6) * 0.006;
    }

    if (hoverPulseSpriteRef.current && hoverPulseMaterialRef.current && hoveredPoint) {
      const p = (Math.sin(elapsedRef.current * 5.4) + 1) / 2;
      hoverPulseSpriteRef.current.scale.set(0.23 + p * 0.07, 0.23 + p * 0.07, 0.23 + p * 0.07);
      hoverPulseMaterialRef.current.opacity = 0.32 + p * 0.42;
    }
  });

  if (points.length === 0) return null;

  function handlePointPointerMove(event: any) {
    if (!isEntered || isFading || isMapInteracting || pointClickStartRef.current) {
      clearHoveredPoint();
      return;
    }

    const pointIndex = event.index;
    if (typeof pointIndex !== "number") { clearHoveredPoint(); return; }

    // FIX 2: Consistent threshold — match raycaster threshold exactly (0.14).
    // No secondary distanceToRay check that was narrower than the raycaster itself.
    if (hoveredIndexRef.current === pointIndex) return;

    const point = points[pointIndex];
    const hasDeepExplanation = Boolean(point?.explanation || point?.frameInfo || (point?.bucketsInBio?.length ?? 0) > 0);

    if (!point || !hasDeepExplanation) { clearHoveredPoint(); return; }

    const recomputedLocalShare = exploredLocalShares?.get(point.bioId);
    const c = pointColorMode === "local"
      ? getStrongLocalColor(recomputedLocalShare?.womanShare ?? point.localWomanShare)
      : getRawGenderColor(point.genderLabel);

    hoveredIndexRef.current = pointIndex;
    setHoveredPoint({
      index: pointIndex,
      localPosition: [positions[pointIndex * 3], positions[pointIndex * 3 + 1], positions[pointIndex * 3 + 2]],
      color: colorToHex(c),
    });

    if (typeof document !== "undefined") document.body.style.cursor = "pointer";
  }

  function handlePointPointerDown(event: any) {
    if (!isEntered || isFading) return;
    clearHoveredPoint();

    const pointIndex = event.index;
    if (typeof pointIndex !== "number") { pointClickStartRef.current = null; return; }

    pointClickStartRef.current = {
      x: event.nativeEvent?.clientX ?? 0,
      y: event.nativeEvent?.clientY ?? 0,
      index: pointIndex,
    };
  }

  function handlePointPointerUp(event: any) {
    if (!isEntered || isFading) return;

    const start = pointClickStartRef.current;
    pointClickStartRef.current = null;
    if (!start) return;

    const endX = event.nativeEvent?.clientX ?? start.x;
    const endY = event.nativeEvent?.clientY ?? start.y;
    if (Math.hypot(endX - start.x, endY - start.y) > 12) return;

    const point = points[start.index];
    if (!point) return;

    event.stopPropagation();
    clearHoveredPoint();

    // FIX 1 continued: positions array is the definitive source of scene position.
    // We compute from it directly rather than using localToWorld on the group,
    // which was unreliable when the group had a non-identity scale from pulsing.
    const scenePosition = new THREE.Vector3(
      positions[start.index * 3],
      positions[start.index * 3 + 1],
      positions[start.index * 3 + 2]
    );

    onSelectPoint({ point, scenePosition });
  }

  return (
    <group ref={groupRef}>
      <points
        onPointerMove={handlePointPointerMove}
        onPointerDown={handlePointPointerDown}
        onPointerUp={handlePointPointerUp}
        onPointerOut={() => { clearHoveredPoint(); pointClickStartRef.current = null; }}
        onPointerLeave={() => { clearHoveredPoint(); pointClickStartRef.current = null; }}
      >
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={materialRef}
          size={0.11}
          map={circleTexture}
          alphaMap={circleTexture}
          alphaTest={0.25}
          vertexColors
          transparent
          opacity={1}
          depthWrite={false}
          sizeAttenuation
          toneMapped={false}
        />
      </points>

      {hoveredPoint && !isFading && !isMapInteracting && (
        <sprite
          ref={hoverPulseSpriteRef}
          position={hoveredPoint.localPosition}
          scale={[0.24, 0.24, 0.24]}
          renderOrder={30}
          raycast={() => undefined}
        >
          <spriteMaterial
            ref={hoverPulseMaterialRef}
            map={pulseRingTexture}
            alphaMap={pulseRingTexture}
            color={hoveredPoint.color}
            transparent
            opacity={0.6}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </sprite>
      )}
    </group>
  );
}

function cleanDisplayValue(value: string | undefined): string {
  return (value ?? "").trim().replace(/_/g, " ").replace(/\s+/g, " ");
}

function joinUniqueDisplay(values: Array<string | undefined>, fallback: string): string {
  const cleaned = values.map(cleanDisplayValue).filter((v) => v.length > 0).filter((v) => !v.toLowerCase().startsWith("unknown"));
  return Array.from(new Set(cleaned)).join(" · ") || fallback;
}

function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Unknown";
  return `${(value * 100).toFixed(digits)}%`;
}

function frameSidePriority(bucketLean: string): number {
  const side = normalizeFrameSide(bucketLean);
  if (side === "man") return 0;
  if (side === "woman") return 1;
  return 2;
}

function bucketStrength(bucket: DataDrivenBucket): number {
  return Math.abs(bucket.score ?? bucket.differenceFromBaseline ?? 0);
}

function compareBucketsForExplanation(a: DataDrivenBucket, b: DataDrivenBucket): number {
  const sideDiff = frameSidePriority(a.bucketLean) - frameSidePriority(b.bucketLean);
  if (sideDiff !== 0) return sideDiff;
  const strengthDiff = bucketStrength(b) - bucketStrength(a);
  if (Math.abs(strengthDiff) > 0.000001) return strengthDiff;
  return a.displayName.localeCompare(b.displayName);
}

function patternDirection(pred: string, prob: number | null | undefined): "woman" | "man" | "mixed" {
  const c = pred.toLowerCase();
  if (c.includes("woman") && !c.includes("man")) return "woman";
  if (c.includes("man")) return "man";
  if (prob !== null && prob !== undefined && Number.isFinite(prob)) {
    if (prob >= 0.55) return "woman";
    if (prob <= 0.45) return "man";
  }
  return "mixed";
}

function userFacingPatternLabel(pred: string, prob: number | null | undefined): string {
  const d = patternDirection(pred, prob);
  if (d === "woman") return "Closer to woman-labeled writing patterns";
  if (d === "man") return "Closer to man-labeled writing patterns";
  return "Near the middle of the learned writing patterns";
}

function compactPatternLabel(pred: string, prob: number | null | undefined): string {
  const d = patternDirection(pred, prob);
  if (d === "woman") return "Woman-leaning";
  if (d === "man") return "Man-leaning";
  return "Mixed / unclear";
}

function NearbyBiographyBar({
  womanPercent,
  label = "Nearby biographies",
}: {
  womanPercent: number;
  label?: string;
}) {
  const womanShare = Math.max(0, Math.min(100, Math.round(womanPercent)));
  const manShare = 100 - womanShare;
  const dominantSide: GenderOption = womanShare >= manShare ? "woman" : "man";
  const dominantPercent = Math.max(womanShare, manShare);
  const dominantLabel = dominantSide === "woman" ? "woman" : "man";

  return (
    <div className="nearby-biography-readout" style={{ "--nearby-woman-pct": `${womanShare}%` } as CSSProperties}>
      <div className={`nearby-big-percent ${dominantSide}`}>
        <strong>{dominantPercent}%</strong>
        <span>{dominantLabel}</span>
      </div>
      <div className="nearby-bar-block">
        <div className="nearby-label-row">
          <span>{label}</span>
          <strong>{womanShare}% woman share · {manShare}% man share</strong>
        </div>
        <div
          className="nearby-gradient-track"
          aria-label={`${label}: marker shows ${womanShare}% woman share and ${manShare}% man share`}
        >
          <span className="nearby-gradient-marker" />
        </div>
        <div className="nearby-axis-labels">
          <span>0% woman / mostly man</span>
          <span>100% woman / mostly woman</span>
        </div>
        <p className={`nearby-marker-note ${dominantSide}`}>
          The marker shows <strong>woman share</strong> on the bar; the large number shows the dominant nearby label.
        </p>
      </div>
    </div>
  );
}

function PhraseEvidenceColumn({ title, phrases, emptyText, side }: { title: string; phrases: string[]; emptyText: string; side: FrameSide }) {
  return (
    <div className={`phrase-evidence-column ${side}`}>
      <h4>{title}</h4>
      {phrases.length === 0
        ? <p className="explanation-empty">{emptyText}</p>
        : <div className="phrase-chip-list">{phrases.map((p) => <span key={p} className="phrase-chip">{p}</span>)}</div>
      }
    </div>
  );
}

function frameSideLabel(side: FrameSide): string {
  if (side === "woman") return "Woman-associated";
  if (side === "man") return "Man-associated";
  return "Unlabeled";
}

function mapLeanDisplay(value: string | undefined): string {
  const c = cleanDisplayValue(value);
  if (!c) return "Map lean unavailable";
  const normalized = c.replace(/female/gi, "woman").replace(/male/gi, "man").trim();
  if (/^woman$/i.test(normalized)) return "woman-leaning";
  if (/^man$/i.test(normalized)) return "man-leaning";
  if (/^woman[-\s]?leaning$/i.test(normalized)) return "woman-leaning";
  if (/^man[-\s]?leaning$/i.test(normalized)) return "man-leaning";
  return normalized;
}

function FrameEvidenceCard({ frame }: { frame: DataDrivenBucket }) {
  const evidence = ((frame.evidence && frame.evidence.length > 0) ? frame.evidence : frame.topTerms).slice(0, 6);
  return (
    <article className={`frame-evidence-card frame-${frame.frameSide ?? normalizeFrameSide(frame.bucketLean)}`}>
      <div className="frame-evidence-title-row">
        <strong>{frame.displayName}</strong>
      </div>
      <p className="frame-evidence-terms">
        {evidence.length > 0 ? evidence.join(" · ") : frame.description || "No specific evidence phrases listed."}
      </p>
    </article>
  );
}

function FrameEvidenceColumn({ side, frames }: { side: FrameSide; frames: DataDrivenBucket[] }) {
  const isWoman = side === "woman";
  return (
    <section className={`frame-side-column ${isWoman ? "woman" : "man"}`}>
      <div className="frame-side-heading">
        <h4>{isWoman ? "Woman-associated frame evidence" : "Man-associated frame evidence"}</h4>
        <p>{isWoman ? "Frames that pull this biography toward the woman-associated side of the learned separation." : "Frames that pull this biography toward the man-associated side of the learned separation."}</p>
      </div>
      {frames.length === 0
        ? <p className="explanation-empty">No {frameSideLabel(side).toLowerCase()} frames listed for this point.</p>
        : <div className="frame-evidence-stack">{frames.map((f) => <FrameEvidenceCard key={f.bucketId} frame={f} />)}</div>
      }
    </section>
  );
}

function normalizePersonName(value: string | undefined): string {
  return cleanFilterText(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_–—-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(dr|prof|professor|sir|dame)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePointId(value: string | undefined): string {
  return cleanFilterText(value ?? "").toLowerCase().replace(/^wiki[_-]?/i, "").replace(/^bio[_-]?/i, "").replace(/[^a-z0-9]/g, "");
}

function getPointIdCandidates(value: string | undefined): string[] {
  const raw = cleanFilterText(value ?? "").toLowerCase();
  const normalized = normalizePointId(raw);
  const qid = raw.match(/q\d+/i)?.[0]?.toLowerCase() ?? "";
  const pid = raw.match(/p\d+/i)?.[0]?.toLowerCase() ?? "";
  return Array.from(new Set([raw, normalized, normalizePointId(qid), normalizePointId(pid)].filter(Boolean)));
}

function pointIdsMatch(left: string | undefined, right: string | undefined): boolean {
  const l = getPointIdCandidates(left);
  const r = getPointIdCandidates(right);
  if (l.length === 0 || r.length === 0) return false;
  return l.some((lv) => r.some((rv) => lv === rv));
}

function findPointByBioId(bioId: string | undefined, points: BioPoint[]): BioPoint | undefined {
  return points.find((p) => pointIdsMatch(p.bioId, bioId));
}

function findPointForSimilarProfile(profile: SimilarProfile, points: BioPoint[]): BioPoint | undefined {
  const byId = findPointByBioId(profile.bioId, points);
  if (byId) return byId;

  const profileName = normalizePersonName(profile.name);
  if (!profileName) return undefined;

  const exact = points.find((p) => normalizePersonName(p.name) === profileName);
  if (exact) return exact;

  return points.find((p) => {
    const n = normalizePersonName(p.name);
    return n.length > 3 && profileName.length > 3 && (n.includes(profileName) || profileName.includes(n));
  });
}

function SimilarProfileList({ profiles, points, onSelectProfile }: { profiles: SimilarProfile[]; points: BioPoint[]; onSelectProfile: (bioId: string) => void }) {
  if (profiles.length === 0) return null;

  return (
    <div className="similar-profile-strip">
      <h3>Similar biographies nearby</h3>
      <p>Click a nearby profile to jump to that point and read its explanation.</p>
      <div className="similar-profile-list">
        {profiles.slice(0, 7).map((profile, i) => {
          const matched = findPointForSimilarProfile(profile, points);
          const genderLabel = profile.genderLabel || matched?.genderLabel || "";
          const side = normalizeFrameSide(genderLabel);
          const isClickable = Boolean(matched);
          return (
            <button
              key={`${profile.bioId ?? profile.name}-${i}`}
              type="button"
              className={`similar-profile-chip ${side} ${isClickable ? "clickable" : "disabled"}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); if (matched) onSelectProfile(matched.bioId); }}
              disabled={!isClickable}
              title={isClickable ? `Open ${profile.name}` : "Not found in current point CSV."}
            >
              <strong>{profile.name}</strong>
              {genderLabel && <em>{cleanDisplayValue(genderLabel)}</em>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CirclePill({ label, value, panel, activePanel, setActivePanel }: { label: string; value: string; panel: SelectedCirclePanel; activePanel: SelectedCirclePanel; setActivePanel: (p: SelectedCirclePanel) => void }) {
  return (
    <button className={`selected-orbit-pill orbit-${panel} ${activePanel === panel ? "active" : ""}`} onClick={() => setActivePanel(panel)}>
      <strong>{label}</strong>
      <span>{value}</span>
    </button>
  );
}

function SelectedPointOverlay({
  selectedPoint,
  pointColorMode,
  allPoints,
  exploredLocalInfo,
  exploreNeighborK,
  onExploreNeighborKChange,
  onClearExploredSet,
  onSelectProfile,
  onClose,
  isMobileSideways = false,
}: {
  selectedPoint: SelectedBioPoint;
  pointColorMode: PointColorMode;
  allPoints: BioPoint[];
  exploredLocalInfo: ExploredLocalInfo | null;
  exploreNeighborK: number;
  onExploreNeighborKChange: (k: number) => void;
  onClearExploredSet: () => void;
  onSelectProfile: (bioId: string) => void;
  onClose: () => void;
  isMobileSideways?: boolean;
}) {
  const { point } = selectedPoint;
  const [activePanel, setActivePanel] = useState<SelectedCirclePanel>("summary");

  const womanPercent = Math.round(point.localWomanShare * 100);
  const manPercent = 100 - womanPercent;
  const lifespan = point.birthYear || point.deathYear ? `${point.birthYear ?? "?"}–${point.deathYear ?? "unknown"}` : "Dates unknown";
  const sourceText = point.sourceName || "Unknown source";
  const genderText = point.genderLabel || "Unknown gender label";
  const fieldText = joinUniqueDisplay([point.fieldBucket, point.primaryField], "Unknown field");
  const roleCareerText = joinUniqueDisplay([point.primaryRole, point.careerType], "Unknown role / career");

  const predictedColor = pointColorMode === "local" ? getStrongLocalColor(point.localWomanShare) : getRawGenderColor(point.genderLabel);
  const overlayStyle: SelectedCircleStyle = {
    "--selected-accent": colorToHex(predictedColor),
    "--selected-ring": colorToHex(getRawGenderColor(point.genderLabel)),
  };

  const explanation = point.explanation;
  const predictedPattern = explanation?.predictedGenderPatternStrict ?? "No explanation row found";
  const probability = explanation?.probWomanPatternStrict ?? null;
  const patternLabel = compactPatternLabel(predictedPattern, probability);
  const readablePattern = userFacingPatternLabel(predictedPattern, probability);
  const labelSide = normalizeFrameSide(point.genderLabel);
  const mapLeanSide = normalizeFrameSide(point.frameInfo?.predictedMapLean || patternLabel);

  const centerContent = {
    summary: (
      <>
        <h2>{point.name || "Unknown name"}</h2>
        <p><strong>Gender label:</strong> {genderText}</p>
        <p><strong>Role / Career:</strong> {roleCareerText}</p>
        <p><strong>Field:</strong> {fieldText}</p>
        <p><strong>Nearby:</strong> {womanPercent}% woman / {manPercent}% man</p>
      </>
    ),
    pattern: (
      <>
        <h2>Pattern</h2>
        <p><strong>Text pattern:</strong> {readablePattern}</p>
        <p><strong>Woman-pattern score:</strong> {formatPercent(probability, 0)}</p>
        <p><strong>Nearby biographies:</strong> {womanPercent}% woman / {manPercent}% man</p>
      </>
    ),
    dates: (
      <>
        <h2>Life Dates</h2>
        <p><strong>Birth:</strong> {point.birthYear ?? "Unknown"}</p>
        <p><strong>Death:</strong> {point.deathYear ?? "Unknown"}</p>
        <p><strong>Word count:</strong> {point.wordCount ?? "Unknown"}</p>
      </>
    ),
    source: (
      <>
        <h2>Source</h2>
        <p><strong>Source:</strong> {sourceText}</p>
        <p><strong>Type:</strong> {point.sourceType || "Unknown"}</p>
        {point.sourceUrl && <a className="selected-circle-link" href={point.sourceUrl} target="_blank" rel="noreferrer">Open source</a>}
      </>
    ),
    field: (
      <>
        <h2>Field</h2>
        <p><strong>Field bucket:</strong> {point.fieldBucket || "Unknown field bucket"}</p>
        <p><strong>Primary field:</strong> {point.primaryField || "Unknown primary field"}</p>
      </>
    ),
    career: (
      <>
        <h2>Role / Career</h2>
        <p><strong>Primary role:</strong> {point.primaryRole || "Unknown role"}</p>
        <p><strong>Career type:</strong> {point.careerType || "Unknown career type"}</p>
      </>
    ),
    text: (
      <>
        <h2>Full Biography Text</h2>
        <div className="selected-circle-scroll">{point.textMasked || "No full biography text available."}</div>
      </>
    ),
  }[activePanel];

  const sortedFrames = [...point.bucketsInBio].sort(compareBucketsForExplanation);
  const manFrames = sortedFrames.filter((f) => (f.frameSide ?? normalizeFrameSide(f.bucketLean)) === "man");
  const womanFrames = sortedFrames.filter((f) => (f.frameSide ?? normalizeFrameSide(f.bucketLean)) === "woman");
  const unassigned = sortedFrames.filter((f) => (f.frameSide ?? normalizeFrameSide(f.bucketLean)) === "unknown");
  const mapLean = mapLeanDisplay(point.frameInfo?.predictedMapLean || patternLabel);
  const labelChip = genderText ? `${cleanDisplayValue(genderText)}-labeled` : "Label unavailable";
  const similarProfiles = point.frameInfo?.similarProfiles ?? [];

  const mobileSidewaysOverlayStyle: CSSProperties | undefined = isMobileSideways
    ? {
        position: "fixed",
        top: "50%",
        left: "50%",
        width: "100dvh",
        height: "100dvw",
        transform: "translate(-50%, -50%) rotate(90deg)",
        WebkitTransform: "translate(-50%, -50%) rotate(90deg)",
        transformOrigin: "center center",
        zIndex: 9999,
        overflow: "hidden",
        padding: "8px",
        background: "rgba(243, 248, 255, 0.94)",
        backdropFilter: "blur(8px)",
      }
    : undefined;

  return (
    <div
      className={`selected-exhibit-overlay${isMobileSideways ? " is-mobile-sideways-exhibit" : ""}`}
      style={{ ...overlayStyle, ...mobileSidewaysOverlayStyle }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="selected-exhibit-shell">
        <section className="selected-circle-column" aria-label="Selected biography details">
          <button className="selected-close-button" onClick={onClose}>Close</button>
          <div className="selected-circle-system">
            <div className="selected-circle-ring">
              <div className="selected-circle-core">{centerContent}</div>
            </div>
            <CirclePill label="Name" value={point.name || "Unknown"} panel="summary" activePanel={activePanel} setActivePanel={setActivePanel} />
            <CirclePill label="Pattern" value={`${womanPercent}% woman / ${manPercent}% man`} panel="pattern" activePanel={activePanel} setActivePanel={setActivePanel} />
            <CirclePill label="Dates" value={lifespan} panel="dates" activePanel={activePanel} setActivePanel={setActivePanel} />
            <CirclePill label="Source" value={sourceText} panel="source" activePanel={activePanel} setActivePanel={setActivePanel} />
            <CirclePill label="Text" value="Full biography" panel="text" activePanel={activePanel} setActivePanel={setActivePanel} />
            <CirclePill label="Field" value={fieldText} panel="field" activePanel={activePanel} setActivePanel={setActivePanel} />
            <CirclePill label="Role" value={roleCareerText} panel="career" activePanel={activePanel} setActivePanel={setActivePanel} />
          </div>
        </section>

        <aside className="explanation-bar" aria-label="Point explanation">
          <div className="explanation-header">
            <div>
              <p className="eyebrow">Point explanation</p>
              <h2>Why this biography lands here</h2>
            </div>
          </div>

          {!explanation && (
            <p className="explanation-warning">No matching row was found in point_explanations_data_driven_buckets.csv for this bio_id.</p>
          )}

          <div className="explanation-card explanation-top-card point-lead-card">
            <div className="lead-label-row">
              <span className={`lead-label-pill ${labelSide}`}>{labelChip}</span>
              <span className={`lead-map-lean ${mapLeanSide}`}>{mapLean}</span>
            </div>
            <NearbyBiographyBar womanPercent={womanPercent} />
          </div>

          <div className="explanation-card explored-local-section">
            <div className="explored-local-header">
              <div>
                <h3>Current explored local view</h3>
                <p>
                  Save a search/filter state, then this recomputes the selected point's local gender mix inside that smaller explored set.
                </p>
              </div>

              <label className="explored-k-control">
                neighboring bios
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={exploreNeighborK}
                  onChange={(event) => onExploreNeighborKChange(Number(event.target.value))}
                />
              </label>
            </div>

            {exploredLocalInfo ? (
              <>
                <NearbyBiographyBar
                  womanPercent={exploredLocalInfo.womanPercent}
                  label="Current explored view"
                />
                <p className="explored-local-note">
                  Based on {exploredLocalInfo.neighborCount} neighboring bios to this point inside your saved set of {exploredLocalInfo.exploredSetSize} explored biographies.
                </p>
                <button
                  type="button"
                  className="explored-local-clear-button"
                  onClick={onClearExploredSet}
                >
                  Clear explored local view
                </button>
              </>
            ) : (
              <p className="explored-local-empty">
                No explored local view has been saved yet. Close this point, use search/filters to create a subset, then press <strong>Recompute from current view</strong>.
              </p>
            )}
          </div>

          <div className="explanation-card frames-card-section">
            <div className="frames-section-heading">
              <h3>Frame evidence</h3>
              <p>Man-associated frames are shown on the left; woman-associated frames are shown on the right.</p>
            </div>
            {sortedFrames.length === 0 ? (
              <p className="explanation-empty">No public frame evidence was listed for this point.</p>
            ) : (
              <>
                <div className="frame-evidence-columns">
                  <FrameEvidenceColumn side="man" frames={manFrames} />
                  <FrameEvidenceColumn side="woman" frames={womanFrames} />
                </div>
                {unassigned.length > 0 && (
                  <div className="unassigned-frame-row">
                    <h4>Other detected frames</h4>
                    <div className="frame-evidence-stack">{unassigned.map((f) => <FrameEvidenceCard key={f.bucketId} frame={f} />)}</div>
                  </div>
                )}
              </>
            )}
          </div>

          <SimilarProfileList profiles={similarProfiles} points={allPoints} onSelectProfile={onSelectProfile} />

          <div className="explanation-card phrase-evidence-card phrase-evidence-bottom-card">
            <h3>Dominant phrase evidence</h3>
            <div className="phrase-evidence-grid">
              <PhraseEvidenceColumn side="man" title="Man-associated phrases" phrases={explanation?.topPhrasesPushingManStrict ?? []} emptyText="No man-associated phrases listed for this point." />
              <PhraseEvidenceColumn side="woman" title="Woman-associated phrases" phrases={explanation?.topPhrasesPushingWomanStrict ?? []} emptyText="No woman-associated phrases listed for this point." />
            </div>
            <p className="explanation-help-note">These are not "good" or "bad" words. They are phrases the classifier learned were more common in woman-labeled or man-labeled biographies.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

async function decodeMaybeGzipText(response: Response, path: string): Promise<string> {
  if (!path.endsWith(".gz")) return response.text();

  const encoding = response.headers.get("content-encoding")?.toLowerCase() ?? "";
  if (encoding.includes("gzip")) {
    // Browser already handles gzip transfer encoding for fetch().
    return response.text();
  }

  const streamCtor = (globalThis as { DecompressionStream?: new (format: string) => TransformStream }).DecompressionStream;
  if (!streamCtor) {
    return response.text();
  }

  const responseClone = response.clone();

  try {
    const compressed = await response.arrayBuffer();
    const decompressor = new streamCtor("gzip");
    const decompressedStream = new Blob([compressed]).stream().pipeThrough(decompressor);
    return new Response(decompressedStream).text();
  } catch {
    // Fall back to text from an untouched clone if manual gunzip fails.
    return responseClone.text();
  }
}

async function fetchCsvText(paths: string[], required: boolean): Promise<string | null> {
  let lastErrorMessage = "";

  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        lastErrorMessage = `Failed to load CSV at ${path}: ${response.status}`;
        continue;
      }
      return await decodeMaybeGzipText(response, path);
    } catch (error) {
      lastErrorMessage = `Failed to load CSV at ${path}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  if (required) throw new Error(lastErrorMessage || "Failed to load required CSV.");
  if (lastErrorMessage) console.warn(lastErrorMessage);
  return null;
}

function getScenePositionForPoint(point: BioPoint, layoutScale: LayoutScale | null): THREE.Vector3 {
  if (!layoutScale) return new THREE.Vector3(0, 0, 0);
  const { centerX, centerY, centerZ, sceneScale } = layoutScale;
  return new THREE.Vector3(
    (point.x - centerX) * sceneScale,
    (point.z - centerZ) * sceneScale,
    (point.y - centerY) * sceneScale
  );
}

// FIX 3: Parse the main CSV row into a BioPoint without needing enrichment data.
// Enrichment (explanations, frames) is applied later in a second pass.
function clampExploreNeighborK(value: number): number {
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(50, Math.round(value)));
}

function squaredEmbeddingDistance(a: BioPoint, b: BioPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function embeddingCoordinate(point: BioPoint, axis: 0 | 1 | 2): number {
  if (axis === 0) return point.x;
  if (axis === 1) return point.y;
  return point.z;
}

function buildNeighborSearchTree(
  sourcePoints: BioPoint[],
  depth = 0
): NeighborSearchNode | null {
  if (sourcePoints.length === 0) return null;

  const axis = (depth % 3) as 0 | 1 | 2;
  const sorted = [...sourcePoints].sort(
    (a, b) => embeddingCoordinate(a, axis) - embeddingCoordinate(b, axis)
  );
  const middle = Math.floor(sorted.length / 2);

  return {
    point: sorted[middle],
    axis,
    left: buildNeighborSearchTree(sorted.slice(0, middle), depth + 1),
    right: buildNeighborSearchTree(sorted.slice(middle + 1), depth + 1),
  };
}

function insertNearestCandidate(
  nearest: Array<{ point: BioPoint; distance: number }>,
  candidate: BioPoint,
  distance: number,
  k: number
) {
  nearest.push({ point: candidate, distance });
  nearest.sort((a, b) => a.distance - b.distance);

  if (nearest.length > k) {
    nearest.pop();
  }
}

function findNearestGenderedNeighbors(
  root: NeighborSearchNode | null,
  target: BioPoint,
  requestedK: number
): BioPoint[] {
  const k = clampExploreNeighborK(requestedK);
  const nearest: Array<{ point: BioPoint; distance: number }> = [];

  function search(node: NeighborSearchNode | null) {
    if (!node) return;

    const candidate = node.point;
    const gender = normalizeFrameSide(candidate.genderLabel);

    if (!pointIdsMatch(candidate.bioId, target.bioId) && (gender === "woman" || gender === "man")) {
      insertNearestCandidate(nearest, candidate, squaredEmbeddingDistance(target, candidate), k);
    }

    const axis = node.axis;
    const delta = embeddingCoordinate(target, axis) - embeddingCoordinate(candidate, axis);
    const nearBranch = delta <= 0 ? node.left : node.right;
    const farBranch = delta <= 0 ? node.right : node.left;

    search(nearBranch);

    const worstDistance = nearest.length < k ? Number.POSITIVE_INFINITY : nearest[nearest.length - 1].distance;
    if (delta * delta <= worstDistance) {
      search(farBranch);
    }
  }

  search(root);

  return nearest.map((item) => item.point);
}

function womanShareFromNeighbors(neighbors: BioPoint[]): number | null {
  if (neighbors.length === 0) return null;

  const womanCount = neighbors.filter(
    (neighbor) => normalizeFrameSide(neighbor.genderLabel) === "woman"
  ).length;

  return womanCount / neighbors.length;
}

function computeExploredLocalShareMap(
  exploredPoints: BioPoint[],
  requestedK: number
): ExploredLocalShareMap {
  const k = clampExploreNeighborK(requestedK);
  const tree = buildNeighborSearchTree(exploredPoints);
  const localShareMap: ExploredLocalShareMap = new Map();

  exploredPoints.forEach((point) => {
    const neighbors = findNearestGenderedNeighbors(tree, point, k);
    const womanShare = womanShareFromNeighbors(neighbors);

    if (womanShare !== null) {
      localShareMap.set(point.bioId, {
        womanShare,
        neighborCount: neighbors.length,
      });
    }
  });

  return localShareMap;
}

function computeExploredLocalInfo(
  selectedPoint: BioPoint,
  exploredPoints: BioPoint[] | null,
  requestedK: number
): ExploredLocalInfo | null {
  if (!exploredPoints || exploredPoints.length < 2) return null;

  const k = clampExploreNeighborK(requestedK);
  const tree = buildNeighborSearchTree(exploredPoints);
  const neighbors = findNearestGenderedNeighbors(tree, selectedPoint, k);
  const womanShare = womanShareFromNeighbors(neighbors);

  if (womanShare === null) return null;

  const womanPercent = Math.round(womanShare * 100);

  return {
    womanPercent,
    manPercent: 100 - womanPercent,
    neighborCount: neighbors.length,
    exploredSetSize: exploredPoints.length,
    k,
  };
}

function randomizePointOrder(points: BioPoint[]): BioPoint[] {
  const shuffled = [...points];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

async function loadEnrichmentMaps(): Promise<{
  explanationMap: Map<string, PointExplanation>;
  frameDefinitionMap: Map<string, FrameDefinition>;
  frameInfoMap: Map<string, PointFrameInfo>;
}> {
  const [explanationCsvText, pointFramesCsvText, frameDefinitionsCsvText] = await Promise.all([
    fetchCsvText(EXPLANATIONS_PATHS, false),
    fetchCsvText(POINT_FRAMES_PATHS, false),
    fetchCsvText(FRAME_DEFINITIONS_PATHS, false),
  ]);

  const parsedExplanations = explanationCsvText
    ? Papa.parse<ExplanationCsvRow>(explanationCsvText, { header: true, skipEmptyLines: true, transformHeader: normalizeCsvHeader })
    : { data: [] as ExplanationCsvRow[] };

  const parsedPointFrames = pointFramesCsvText
    ? Papa.parse<PointFramesCsvRow>(pointFramesCsvText, { header: true, skipEmptyLines: true, transformHeader: normalizeCsvHeader })
    : { data: [] as PointFramesCsvRow[] };

  const parsedFrameDefinitions = frameDefinitionsCsvText
    ? Papa.parse<FrameDefinitionCsvRow>(frameDefinitionsCsvText, { header: true, skipEmptyLines: true, transformHeader: normalizeCsvHeader })
    : { data: [] as FrameDefinitionCsvRow[] };

  const frameDefinitionMap = new Map<string, FrameDefinition>();

  parsedFrameDefinitions.data.forEach((row) => {
    const def = createFrameDefinition(row);
    if (def) {
      frameDefinitionMap.set(def.frameId, def);
      frameDefinitionMap.set(cleanFilterText(def.frameId), def);
      frameDefinitionMap.set(normalizeFrameLookupValue(def.frameId), def);
      frameDefinitionMap.set(normalizeFrameLookupValue(def.label), def);
    }
  });

  const explanationMap = new Map<string, PointExplanation>();

  parsedExplanations.data.forEach((row) => {
    const ex = createExplanation(row);
    if (ex) explanationMap.set(ex.bioId, ex);
  });

  const frameInfoMap = new Map<string, PointFrameInfo>();

  parsedPointFrames.data.forEach((row) => {
    const fi = createPointFrameInfo(row, frameDefinitionMap);
    if (fi) frameInfoMap.set(fi.bioId, fi);
  });

  return { explanationMap, frameDefinitionMap, frameInfoMap };
}

function parseCsvRowToBasePoint(row: CsvPoint): BioPoint | null {
  const x = toNumber(row.x);
  const y = toNumber(row.y);
  const z = toNumber(row.z);
  if (x === null || y === null || z === null) return null;

  return {
    bioId: cleanFilterText(row.bio_id),
    name: row.name,
    genderLabel: row.gender_label,
    birthYear: toNumber(row.birth_year) ?? undefined,
    deathYear: toNumber(row.death_year) ?? undefined,
    sourceType: row.source_type,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    fieldBucket: row.field_bucket,
    careerType: row.career_type,
    primaryField: row.primary_field,
    primaryRole: row.primary_role,
    wordCount: toNumber(row.word_count) ?? undefined,
    textMasked: getFullBiographyText(row),
    x,
    y,
    z,
    localWomanShare: toNumber(row.local_woman_share) ?? 0.5,
    explanation: undefined,
    bucketIds: [],
    bucketsInBio: [],
    frameInfo: undefined,
  };
}

export default function LatentIntro({
  isEntered,
  isHomeIntroReady,
  pointColorMode,
  filters,
  onFilterOptionsChange,
  onVisibleCountChange,
  onSelectedPointChange,
  onLoadProgressChange,
  onLatentReadyChange,
  uiShellRef,
}: LatentIntroProps) {
  const [points, setPoints] = useState<BioPoint[]>([]);
  const [isPointCloudVisible, setIsPointCloudVisible] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<SelectedBioPoint | null>(null);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [exploreNeighborK, setExploreNeighborK] = useState(5);
  const [exploredPoints, setExploredPoints] = useState<BioPoint[] | null>(null);
  const [exploredLocalShares, setExploredLocalShares] = useState<ExploredLocalShareMap | null>(null);
  const controlsRef = useRef<any>(null);
  const mapInteractionEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Locked after first non-empty point load — never recomputed so positions never shift
  const layoutScaleRef = useRef<LayoutScale | null>(null);
  
  const [deviceMode] = useState<DeviceMode>(() => getDeviceMode());
  const [deviceNotice, setDeviceNotice] = useState<DeviceNotice | null>(null);
  const [uiShellNode, setUiShellNode] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setUiShellNode(uiShellRef?.current ?? null);
  }, [uiShellRef]);

  useEffect(() => {
    if (!deviceMode.isLimitedDevice || typeof document === "undefined") return undefined;

    if (selectedPoint) {
      document.body.classList.add("mobile-point-selected");
    } else {
      document.body.classList.remove("mobile-point-selected");
    }

    return () => {
      document.body.classList.remove("mobile-point-selected");
    };
  }, [selectedPoint, deviceMode.isLimitedDevice]);

  function startMapInteraction() {
    if (mapInteractionEndTimeoutRef.current) { clearTimeout(mapInteractionEndTimeoutRef.current); mapInteractionEndTimeoutRef.current = null; }
    setIsMapInteracting(true);
  }

  function endMapInteractionSoon() {
    if (mapInteractionEndTimeoutRef.current) clearTimeout(mapInteractionEndTimeoutRef.current);
    mapInteractionEndTimeoutRef.current = setTimeout(() => {
      setIsMapInteracting(false);
      mapInteractionEndTimeoutRef.current = null;
    }, 320);
  }

  const visiblePoints = useMemo(() => points.filter((p) => pointMatchesFilters(p, filters)), [points, filters]);
  // Read from the locked ref — not recomputed when enrichment merges in
  const layoutScale = layoutScaleRef.current;

  const canvasDpr: number | [number, number] = deviceMode.isLimitedDevice
    ? 1
    : [1, 2];

  const exploredLocalInfo = useMemo(() => {
    if (!selectedPoint) return null;

    const recomputedShare = exploredLocalShares?.get(selectedPoint.point.bioId);

    if (exploredPoints && recomputedShare) {
      const womanPercent = Math.round(recomputedShare.womanShare * 100);

      return {
        womanPercent,
        manPercent: 100 - womanPercent,
        neighborCount: recomputedShare.neighborCount,
        exploredSetSize: exploredPoints.length,
        k: exploreNeighborK,
      };
    }

    return computeExploredLocalInfo(selectedPoint.point, exploredPoints, exploreNeighborK);
  }, [selectedPoint, exploredPoints, exploredLocalShares, exploreNeighborK]);

  useEffect(() => { onVisibleCountChange?.(visiblePoints.length, points.length); }, [visiblePoints.length, points.length, onVisibleCountChange]);
  useEffect(() => { onSelectedPointChange?.(selectedPoint !== null); }, [selectedPoint, onSelectedPointChange]);
  useEffect(() => () => { if (mapInteractionEndTimeoutRef.current) clearTimeout(mapInteractionEndTimeoutRef.current); }, []);
  useEffect(() => {
    if (!selectedPoint) return;
    if (!points.some((p) => p.bioId === selectedPoint.point.bioId)) setSelectedPoint(null);
  }, [selectedPoint, points]);

  useEffect(() => {
    // The explored-local colors belong to a specific search/filter result.
    // As soon as the user changes the explored points on screen, return to the original colors
    // until they explicitly recompute the new view.
    setExploredPoints(null);
    setExploredLocalShares(null);
  }, [filters]);

  function selectPointByBioId(bioId: string) {
    const point = findPointByBioId(bioId, points);
    if (!point) { console.warn(`Could not find point for similar profile bioId: ${bioId}`); return; }
    setIsMapInteracting(false);
    setSelectedPoint({ point, scenePosition: getScenePositionForPoint(point, layoutScale) });
  }

  function recomputeLocalSharesForSet(nextExploredPoints: BioPoint[], nextK: number) {
    setExploredPoints([...nextExploredPoints]);
    setExploredLocalShares(computeExploredLocalShareMap(nextExploredPoints, nextK));
  }

  function saveCurrentExploreSet() {
    recomputeLocalSharesForSet(visiblePoints, exploreNeighborK);
  }

  function clearExploredLocalView() {
    setExploredPoints(null);
    setExploredLocalShares(null);
  }

  function updateExploreNeighborK(nextK: number) {
    const clampedK = clampExploreNeighborK(nextK);
    setExploreNeighborK(clampedK);

    if (exploredPoints && exploredPoints.length >= 2) {
      recomputeLocalSharesForSet(exploredPoints, clampedK);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadPoints() {
      setIsPointCloudVisible(false);
      setPoints([]);
      onLatentReadyChange?.(false);
      onLoadProgressChange?.({ loaded: 0, total: 0, phase: "Preparing latent space", isReady: false });
    
      try {
        // Fetch the CSV text first (network; progress bar shows "Preparing")
        const pointCsvText = await fetchCsvText(pointCsvPathsForDevice(deviceMode), true);
        if (!pointCsvText) throw new Error("Point CSV loaded as empty.");
    
        // Yield a frame so "Preparing latent space" actually renders before the
        // synchronous Papa.parse call blocks the thread for ~1–2 s.
        await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
        if (isCancelled) return;
    
        onLoadProgressChange?.({ loaded: 0, total: 0, phase: "Parsing biography data", isReady: false });
    
        // Another yield so "Parsing biography data" paints before the sync parse.
        await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
        if (isCancelled) return;
    
        const parsedPoints = Papa.parse<CsvPoint>(pointCsvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: normalizeCsvHeader,
        });
    
        const basePoints = parsedPoints.data
          .map(parseCsvRowToBasePoint)
          .filter((p): p is BioPoint => p !== null);

        const deviceLimitedBasePoints = deviceMode.isLimitedDevice
          ? limitPointsForDevice(basePoints, deviceMode.maxPoints)
          : basePoints;

        if (deviceMode.isLimitedDevice) {
          setDeviceNotice({
            reason: deviceMode.reason,
            displayedPoints: deviceLimitedBasePoints.length,
            totalPoints: FULL_DATASET_POINT_COUNT,
          });
        } else {
          setDeviceNotice(null);
        }

        // Keep the full-space scale if the full file loaded.
        // This prevents the limited sample from stretching into a fake map shape.
        if (!layoutScaleRef.current) {
          layoutScaleRef.current = getLayoutScale(basePoints);
        }

        const randomizedBasePoints = randomizePointOrder(deviceLimitedBasePoints);

        onLoadProgressChange?.({
          loaded: randomizedBasePoints.length,
          total: randomizedBasePoints.length,
          phase: "Building the latent space",
          isReady: false,
        });

        const { explanationMap, frameDefinitionMap, frameInfoMap } =
          deviceMode.isLimitedDevice
            ? {
                explanationMap: new Map<string, PointExplanation>(),
                frameDefinitionMap: new Map<string, FrameDefinition>(),
                frameInfoMap: new Map<string, PointFrameInfo>(),
              }
            : await loadEnrichmentMaps();
        if (isCancelled) return;
    
        onLoadProgressChange?.({
          loaded: randomizedBasePoints.length,
          total: randomizedBasePoints.length,
          phase: "Adding biography details",
          isReady: false,
        });
    
        const enrichedPoints = randomizedBasePoints.map((point) => {
          const explanation = explanationMap.get(point.bioId);
          const frameInfo = frameInfoMap.get(point.bioId);
          const bucketsInBio = frameInfo?.frames ?? [];
          const bucketIds = bucketsInBio.map((b) => b.bucketId);
    
          return {
            ...point,
            wordCount: point.wordCount ?? explanation?.wordCount,
            textMasked:
              explanation?.textMasked && explanation.textMasked.length > point.textMasked.length
                ? explanation.textMasked
                : point.textMasked,
            explanation,
            bucketIds,
            bucketsInBio,
            frameInfo,
          };
        });
    
        setPoints(enrichedPoints);
        requestAnimationFrame(() => {
          if (!isCancelled) setIsPointCloudVisible(true);
        });
        onFilterOptionsChange?.(getFilterOptions(enrichedPoints));
        onLatentReadyChange?.(true);
        onLoadProgressChange?.({
          loaded: enrichedPoints.length,
          total: enrichedPoints.length,
          phase: "Ready",
          isReady: true,
        });
    
        console.log(`Loaded ${enrichedPoints.length} points after progressive reveal.`);
        console.log(`Loaded ${explanationMap.size} explanations | ${frameDefinitionMap.size} frame defs | ${frameInfoMap.size} frame rows.`);
      } catch (error) {
        console.error("Error loading latent-space CSV data:", error);
        onLoadProgressChange?.({ loaded: 0, total: 0, phase: "Could not load latent space", isReady: false });
      }
    }

    loadPoints();
    return () => { isCancelled = true; };
  }, [deviceMode, onFilterOptionsChange, onLatentReadyChange, onLoadProgressChange]);

  const chromePortals =
    uiShellNode &&
    createPortal(
      <>
        {deviceNotice && (
          <div className="device-warning" role="status" aria-live="polite">
            <strong>Lighter view active.</strong>{" "}
            {deviceNotice.reason} Showing{" "}
            {deviceNotice.displayedPoints.toLocaleString()} of{" "}
            {deviceNotice.totalPoints.toLocaleString()} biographies. Use a stronger device
            to see the full map.
          </div>
        )}

        {isEntered && !selectedPoint && (
          <aside
            className="recompute-controls"
            aria-label="Recompute local view controls"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="recompute-header">
              <div>
                <span className="recompute-title">Explored local view</span>
                <p>Recompute nearby gender mix inside the points currently shown by your filters.</p>
              </div>
            </div>

            <label className="recompute-k-label">
              neighboring bios
              <input
                type="number"
                min={1}
                max={50}
                value={exploreNeighborK}
                onChange={(event) => updateExploreNeighborK(Number(event.target.value))}
              />
            </label>

            <div className="recompute-actions">
              <button
                type="button"
                onClick={saveCurrentExploreSet}
                disabled={visiblePoints.length < 2}
              >
                Recompute from current view
              </button>
              <button
                type="button"
                onClick={clearExploredLocalView}
                disabled={!exploredPoints}
              >
                Clear
              </button>
            </div>

            <p className="recompute-status">
              {exploredPoints
                ? `Recolored ${exploredPoints.length.toLocaleString()} biographies · neighboring bios: ${exploreNeighborK}`
                : `Current view: ${visiblePoints.length.toLocaleString()} biographies`}
            </p>
          </aside>
        )}
      </>,
      uiShellNode
    );

  const selectedPointOverlay = selectedPoint ? (
    <SelectedPointOverlay
      key={selectedPoint.point.bioId}
      selectedPoint={selectedPoint}
      pointColorMode={pointColorMode}
      allPoints={points}
      exploredLocalInfo={exploredLocalInfo}
      exploreNeighborK={exploreNeighborK}
      onExploreNeighborKChange={updateExploreNeighborK}
      onClearExploredSet={clearExploredLocalView}
      onSelectProfile={selectPointByBioId}
      onClose={() => setSelectedPoint(null)}
      isMobileSideways={deviceMode.isLimitedDevice}
    />
  ) : null;

  return (
    <>
    <div className="latent-stage">
      <Canvas
        camera={{ position: [0, 1.3, 8.5], fov: 45 }}
        dpr={canvasDpr}
        style={{ touchAction: "none" }}
      >
        <RaycasterSettings />
        <color attach="background" args={["#f3f8ff"]} />
        <ambientLight intensity={0.9} />
        <pointLight position={[3, 4, 5]} intensity={1.8} />
        <pointLight position={[-4, -2, -3]} intensity={1.0} color="#d85b9f" />
        <CameraIntro isEntered={isEntered} isHomeIntroReady={isHomeIntroReady} />
        <FocusCamera selectedPoint={selectedPoint} controlsRef={controlsRef} enabled={false} />
        <LatentPointCloud
          isEntered={isEntered}
          isHomeIntroReady={isHomeIntroReady}
          points={visiblePoints}
          layoutScale={layoutScale}
          pointColorMode={pointColorMode}
          showPoints={isPointCloudVisible && isHomeIntroReady}
          isFading={selectedPoint !== null}
          isMapInteracting={isMapInteracting}
          exploredLocalShares={exploredLocalShares}
          onSelectPoint={setSelectedPoint}
        />
        <OrbitControls
          ref={controlsRef}
          enabled={isEntered && !selectedPoint}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enableZoom
          zoomToCursor={false}
          enablePan
          screenSpacePanning
          minDistance={1.2}
          maxDistance={12}
          rotateSpeed={0.85}
          zoomSpeed={0.9}
          panSpeed={0.85}
          onStart={startMapInteraction}
          onEnd={endMapInteractionSoon}
        />
      </Canvas>

      {typeof document !== "undefined" &&
        selectedPointOverlay &&
        createPortal(selectedPointOverlay, document.body)}
    </div>

    {chromePortals}
    </>
  );
}