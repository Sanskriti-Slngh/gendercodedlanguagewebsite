import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import LatentIntro, {
  type FilterOptions,
  type GenderOption,
  type PointColorMode,
  type PointFilters,
  type TimePeriodFilter,
  type LatentLoadProgress,
} from "./components/LatentIntro";

const DEFAULT_FILTERS: PointFilters = {
  search: "",
  genders: [],
  timePeriods: [],
  fields: [],
  careers: [],
  buckets: [],
};

const TIME_PERIOD_OPTIONS: Array<{
  value: TimePeriodFilter;
  label: string;
}> = [
  { value: "before1800", label: "Before 1800" },
  { value: "1800to1849", label: "1800–1849" },
  { value: "1850to1899", label: "1850–1899" },
  { value: "1900to1949", label: "1900–1949" },
  { value: "1950plus", label: "1950+" },
  { value: "unknown", label: "Unknown dates" },
];

function toggleArrayValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((currentValue) => currentValue !== value)
    : [...values, value];
}

function App() {
  const [isEntered, setIsEntered] = useState(false);
  const [pointColorMode, setPointColorMode] =
    useState<PointColorMode>("local");
  const [filters, setFilters] = useState<PointFilters>(DEFAULT_FILTERS);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    fieldOptions: [],
    careerOptions: [],
    bucketOptions: [],
  });
  const [visibleCount, setVisibleCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isPointSelected, setIsPointSelected] = useState(false);
  const [isLatentReady, setIsLatentReady] = useState(false);
  const [hasEntrancePlayed, setHasEntrancePlayed] = useState(false);
  const [hasPressedExplore, setHasPressedExplore] = useState(false);
  const [isEntranceDismissed, setIsEntranceDismissed] = useState(false);
  const exploreExitTimeoutRef = useRef<number | null>(null);
  const [loadProgress, setLoadProgress] = useState<LatentLoadProgress>({
    loaded: 0,
    total: 0,
    phase: "Preparing latent space",
    isReady: false,
  });

  useEffect(() => {
    const entranceTimer = window.setTimeout(() => {
      setHasEntrancePlayed(true);
    }, 5000);

    return () => window.clearTimeout(entranceTimer);
  }, []);

  useEffect(() => {
    return () => {
      if (exploreExitTimeoutRef.current !== null) {
        window.clearTimeout(exploreExitTimeoutRef.current);
      }
    };
  }, []);

  const canPressExplore = hasEntrancePlayed && isLatentReady;
  const isHomeIntroReady = isEntranceDismissed && isLatentReady;

  function handleExplorePress() {
    if (!canPressExplore || hasPressedExplore) return;

    setHasPressedExplore(true);

    if (exploreExitTimeoutRef.current !== null) {
      window.clearTimeout(exploreExitTimeoutRef.current);
    }

    exploreExitTimeoutRef.current = window.setTimeout(() => {
      setIsEntranceDismissed(true);
    }, 650);
  }

  function enterSite() {
    if (!isHomeIntroReady) return;

    if (!isEntered) {
      setIsEntered(true);
    }
  }

  function updateSearch(search: string) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      search,
    }));
  }

  function toggleGender(gender: GenderOption) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      genders: toggleArrayValue(currentFilters.genders, gender),
    }));
  }

  function toggleTimePeriod(timePeriod: TimePeriodFilter) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      timePeriods: toggleArrayValue(currentFilters.timePeriods, timePeriod),
    }));
  }

  function toggleField(field: string) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      fields: toggleArrayValue(currentFilters.fields, field),
    }));
  }

  function toggleCareer(career: string) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      careers: toggleArrayValue(currentFilters.careers, career),
    }));
  }

  function toggleBucket(bucketId: string) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      buckets: toggleArrayValue(currentFilters.buckets, bucketId),
    }));
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  const handleVisibleCountChange = useCallback((visible: number, total: number) => {
    setVisibleCount(visible);
    setTotalCount(total);
  }, []);

  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.genders.length > 0 ||
    filters.timePeriods.length > 0 ||
    filters.fields.length > 0 ||
    filters.careers.length > 0 ||
    filters.buckets.length > 0;

  const entrancePercent = loadProgress.total > 0
    ? Math.round((loadProgress.loaded / loadProgress.total) * 100)
    : 0;
  const entranceProgressPercent = hasPressedExplore || canPressExplore
    ? 100
    : Math.max(8, entrancePercent);
  const entranceStatus = hasPressedExplore
    ? "Opening the map…"
    : !hasEntrancePlayed
      ? "Letting the entrance play while the map prepares…"
      : !isLatentReady
        ? `${loadProgress.phase}…`
        : "Press Explore to see how biography language clusters.";
  const entranceButtonLabel = hasPressedExplore
    ? "Opening…"
    : canPressExplore
      ? "Explore"
      : hasEntrancePlayed
        ? "Loading map…"
        : "Entrance playing…";

  return (
    <main
      className={`home-page ${isEntered ? "is-entered" : "is-intro"} ${
        isPointSelected ? "has-selected-point" : ""
      } ${isLatentReady ? "is-latent-ready" : "is-loading-latent"} ${
        isHomeIntroReady ? "is-home-intro-ready" : "is-entrance-active"
      } ${hasPressedExplore ? "has-pressed-explore" : ""}`}
      onPointerDown={enterSite}
    >
      <LatentIntro
        isEntered={isEntered}
        pointColorMode={pointColorMode}
        filters={filters}
        onFilterOptionsChange={setFilterOptions}
        onVisibleCountChange={handleVisibleCountChange}
        onSelectedPointChange={setIsPointSelected}
        onLoadProgressChange={setLoadProgress}
        onLatentReadyChange={setIsLatentReady}
        isHomeIntroReady={isHomeIntroReady}
      />

      {!isHomeIntroReady && (
        <section
          className={`entrance-overlay ${hasEntrancePlayed ? "is-waiting-for-map" : ""} ${canPressExplore ? "is-ready-to-explore" : ""} ${hasPressedExplore ? "has-pressed-explore" : ""}`}
          aria-label="Coded Language entrance"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="entrance-card">
            <p className="entrance-eyebrow">Public biographies → visible patterns</p>
            <h1 className="entrance-title">Coded Language</h1>

            <p className="entrance-purpose">
              This exhibit looks at how public biographies describe people. Each dot
              is one biography. Dots that are close together use similar wording. As
              you explore, you can see which kinds of language appear more often around
              women-labeled or men-labeled biographies in this dataset.
            </p>

            <div className="entrance-mini-grid" aria-label="How to read the exhibit">
              <div className="entrance-mini-card">
                <strong>1. See the patterns</strong>
                <span>Each dot is a biography. Nearby dots are written in similar ways.</span>
              </div>
              <div className="entrance-mini-card">
                <strong>2. Open a biography</strong>
                <span>Click any dot to see the person, similar profiles, and the strongest visible frames in the text.</span>
              </div>
              <div className="entrance-mini-card">
                <strong>3. Ask what changes</strong>
                <span>Recompute the view to see how patterns shift within the biographies currently on screen.</span>
              </div>
            </div>

            <div
              className={`entrance-progress ${canPressExplore ? "is-complete" : ""} ${hasPressedExplore ? "is-green" : ""}`}
              aria-hidden="true"
            >
              <span style={{ width: `${entranceProgressPercent}%` }} />
            </div>

            <button
              className="entrance-explore-button"
              type="button"
              disabled={!canPressExplore || hasPressedExplore}
              onClick={handleExplorePress}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {entranceButtonLabel}
            </button>

            <p className="entrance-status" aria-live="polite">
              {entranceStatus}
            </p>
          </div>
        </section>
      )}

      <section className="intro-content">
        <h1 className="site-title-center">Coded Language</h1>

        <p className={`click-hint${isHomeIntroReady ? "" : " is-waiting"}`}>
          Click anywhere to enter
        </p>

        <h1 className="site-title-corner" aria-hidden="true">
          Coded Language
        </h1>
      </section>

      <div
        className="view-controls"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="view-toggle-row">
          <button
            className={pointColorMode === "raw" ? "active" : ""}
            onClick={() => setPointColorMode("raw")}
          >
            Raw labels
          </button>

          <button
            className={pointColorMode === "local" ? "active" : ""}
            onClick={() => setPointColorMode("local")}
          >
            Local pattern
          </button>
        </div>

        <p className="view-mode-note">
          Raw shows the biography's listed label. Local colors each dot by the
          labels of nearby biographies in the current view.
        </p>
      </div>

      {!isPointSelected && (
        <aside
          className="explore-filters"
          aria-label="Explore biography filters"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="filter-header">
            <span className="filter-title">Explore</span>
            <span className="filter-count">
              {visibleCount} / {totalCount} shown
            </span>
          </div>

          <label className="filter-label">
            Search person, field, source, frame evidence, similar profiles, or masked text
            <input
              value={filters.search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder='Try: Ada chemist, "named awards", mathematics...'
            />
          </label>

          <div className="filter-section">
            <div className="filter-section-title">Gender labels</div>
            <div className="filter-chip-row" aria-label="Gender filters">
              <button
                className={`filter-chip ${filters.genders.length === 0 ? "active" : ""}`}
                onClick={() =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    genders: [],
                  }))
                }
              >
                All
              </button>

              <button
                className={`filter-chip ${filters.genders.includes("woman") ? "active" : ""}`}
                onClick={() => toggleGender("woman")}
              >
                Women
              </button>

              <button
                className={`filter-chip ${filters.genders.includes("man") ? "active" : ""}`}
                onClick={() => toggleGender("man")}
              >
                Men
              </button>
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-section-title">Time periods</div>
            <div className="filter-chip-row" aria-label="Time period filters">
              {TIME_PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`filter-chip ${
                    filters.timePeriods.includes(option.value) ? "active" : ""
                  }`}
                  onClick={() => toggleTimePeriod(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-section-title">Fields</div>
            <div className="option-chip-grid" aria-label="Field filters">
              {filterOptions.fieldOptions.map((field) => (
                <button
                  key={field}
                  className={`option-chip ${filters.fields.includes(field) ? "active" : ""}`}
                  onClick={() => toggleField(field)}
                >
                  {field}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-section-title">Roles / careers</div>
            <div className="option-chip-grid" aria-label="Role and career filters">
              {filterOptions.careerOptions.map((career) => (
                <button
                  key={career}
                  className={`option-chip ${filters.careers.includes(career) ? "active" : ""}`}
                  onClick={() => toggleCareer(career)}
                >
                  {career}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-section-title">Frame evidence</div>
            <div className="bucket-chip-grid" aria-label="Frame evidence filters">
              {filterOptions.bucketOptions.map((bucket) => (
                <button
                  key={bucket.bucketId}
                  className={`bucket-filter-chip ${
                    filters.buckets.includes(bucket.bucketId) ? "active" : ""
                  }`}
                  onClick={() => toggleBucket(bucket.bucketId)}
                  title={`${bucket.displayName}: ${bucket.topTerms.join("; ")}`}
                >
                  <span className="bucket-filter-name">
                    {bucket.displayName}
                  </span>
                  <span className={`bucket-filter-lean ${bucket.bucketLean}`}>
                    {bucket.bucketLean === "woman" ? "woman-associated" : bucket.bucketLean === "man" ? "man-associated" : "unlabeled"}
                  </span>
                  <span className="bucket-filter-preview">
                    {bucket.topTerms.slice(0, 4).join(" · ") || "No evidence phrases"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            className="clear-filters-button"
            disabled={!hasActiveFilters}
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </aside>
      )}

      <div className="gender-legend">
        {pointColorMode === "raw" ? (
          <>
            <span>
              <i className="legend-dot woman-dot" />
              Woman label
            </span>

            <span>
              <i className="legend-dot man-dot" />
              Man label
            </span>
          </>
        ) : (
          <div className="gradient-legend">
            <span>Man-leaning</span>
            <div className="gradient-bar" />
            <span>Woman-leaning</span>
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
