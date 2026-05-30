import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import "./App.css";
import LatentIntro, {
  type FilterOptions,
  type GenderOption,
  type PointColorMode,
  type PointFilters,
  type TimePeriodFilter,
  type LatentLoadProgress,
} from "./components/LatentIntro";
import { getDeviceMode } from "./utils/devicePerformance";

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

type FaqScrollTarget = "findings" | "methodology";

const HOME_GUIDE_ITEMS = [
  {
    label: "What is this?",
    text: "An interactive analysis of how biographies describe men and women differently.",
  },
  {
    label: "Why does it matter?",
    text: "Biographies shape public memory, credibility, and whose achievements feel “important.”",
  },
  {
    label: "What can I do here?",
    text: "Explore people, clusters, gender-coded patterns, similar biographies, and examples.",
  },
  {
    label: "Why trust it?",
    text: "Built from a large public biography dataset with documented masking, embeddings, and limitations—see Methodology for details.",
  },
] as const;

function App() {
  const [isEntered, setIsEntered] = useState(false);
  const [pointColorMode, setPointColorMode] =
    useState<PointColorMode>("local");
  const [filters, setFilters] = useState<PointFilters>(DEFAULT_FILTERS);
  const [searchDraft, setSearchDraft] = useState(DEFAULT_FILTERS.search);
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
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [faqScrollTarget, setFaqScrollTarget] = useState<FaqScrollTarget | null>(null);
  const [hasDismissedFaqGlow, setHasDismissedFaqGlow] = useState(false);
  const exploreExitTimeoutRef = useRef<number | null>(null);
  const [loadProgress, setLoadProgress] = useState<LatentLoadProgress>({
    loaded: 0,
    total: 0,
    phase: "Preparing latent space",
    isReady: false,
  });
  const [deviceMode] = useState(() => getDeviceMode());
  const uiShellRef = useRef<HTMLDivElement>(null);

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

  function handlePagePointerDownCapture(event: ReactPointerEvent) {
    if (!isHomeIntroReady) return;

    const target = event.target as HTMLElement;
    if (
      target.closest(
        ".home-guide, .start-here, .faq-overlay, .entrance-overlay, .view-controls, .explore-sidebar",
      )
    ) {
      return;
    }

    if (!isEntered) {
      setIsEntered(true);
      return;
    }

    if (!hasDismissedFaqGlow) {
      setHasDismissedFaqGlow(true);
    }
  }

  function openFaqSection(section: FaqScrollTarget) {
    setFaqScrollTarget(section);
    setIsFaqOpen(true);
  }

  function stopIntroPointer(event: ReactPointerEvent) {
    event.stopPropagation();
  }

  useLayoutEffect(() => {
    if (!isFaqOpen || !faqScrollTarget) return;

    const sectionId =
      faqScrollTarget === "findings" ? "faq-findings" : "faq-methodology";
    const section = document.getElementById(sectionId);
    section?.scrollIntoView({ block: "start", behavior: "smooth" });
    setFaqScrollTarget(null);
  }, [isFaqOpen, faqScrollTarget]);

  function updateSearch(search: string) {
    setSearchDraft(search);
  }

  function applySearch(search = searchDraft) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      search: search.trim(),
    }));
  }

  function clearSearch() {
    setSearchDraft("");
    setFilters((currentFilters) => ({
      ...currentFilters,
      search: "",
    }));
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      applySearch();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      clearSearch();
    }
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
    setSearchDraft("");
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
  const isSearchPending = searchDraft.trim() !== filters.search.trim();

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
      } ${hasPressedExplore ? "has-pressed-explore" : ""} ${
        deviceMode.isMobileLayout ? "is-mobile-like" : ""
      }`}
      onPointerDownCapture={handlePagePointerDownCapture}
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
        uiShellRef={uiShellRef}
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
              An interactive analysis of how public biographies describe men and women
              differently—each dot is one biography, and nearby dots use similar language.
            </p>

            <div className="entrance-mini-grid" aria-label="How to read the exhibit">
              <div className="entrance-mini-card">
                <strong>1. See the patterns</strong>
                <span>Each dot is a biography. Nearby dots are written in similar ways.</span>
              </div>
              <div className="entrance-mini-card">
                <strong>2. Open a biography</strong>
                <span>Click any dot to see the person, similar profiles, and the strongest woman/man text patterns in the text.</span>
              </div>
              <div className="entrance-mini-card">
                <strong>3. Ask what changes</strong>
                <span>Recompute the view on different subsets of data to see how patterns shift within the biographies currently on screen.</span>
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

      <div ref={uiShellRef} id="home-ui-shell" className="home-ui-shell">
      <section className="intro-content">
        <h1 className="site-title-center">Coded Language</h1>

        {isHomeIntroReady && !isEntered && (
          <>
            <section className="home-guide" aria-label="About this project">
              <div className="home-guide-grid">
                {HOME_GUIDE_ITEMS.map((item) => (
                  <div key={item.label} className="home-guide-item">
                    <p className="home-guide-label">{item.label}</p>
                    <p className="home-guide-text">{item.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="start-here" aria-label="Start here">
              <h2 className="start-here-title">Start Here</h2>
              <div className="start-here-actions">
                <button
                  type="button"
                  className="start-here-button start-here-button--primary"
                  onPointerDown={stopIntroPointer}
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsEntered(true);
                  }}
                >
                  Explore the Map
                </button>
                <button
                  type="button"
                  className="start-here-button"
                  onPointerDown={stopIntroPointer}
                  onClick={(event) => {
                    event.stopPropagation();
                    openFaqSection("findings");
                  }}
                >
                  See Key Findings
                </button>
                <button
                  type="button"
                  className="start-here-button"
                  onPointerDown={stopIntroPointer}
                  onClick={(event) => {
                    event.stopPropagation();
                    openFaqSection("methodology");
                  }}
                >
                  Read the Methodology
                </button>
              </div>
            </section>
          </>
        )}

        <p className={`click-hint${isHomeIntroReady ? "" : " is-waiting"}`}>
          {isHomeIntroReady && !isEntered
            ? "Or click anywhere on the map to enter"
            : "Click anywhere to enter"}
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

      {isFaqOpen && (
        <section
          className="faq-overlay"
          aria-label="Project explanation"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="faq-panel">
            <div className="faq-header">
              <div>
                <p className="faq-eyebrow">How to read this project</p>
                <h2>What is Coded Language?</h2>
              </div>

              <button
                type="button"
                className="faq-close-button"
                onClick={() => setIsFaqOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="faq-sections">
              <article className="faq-section">
                <h3>What is the purpose of this website?</h3>
                <p>This website asks a simple question:</p>
                <p><strong>Are public biographies written differently for women and men?</strong></p>
                <p>
                  A biography is not just a list of facts. It also chooses what to emphasize. One person
                  might be described through awards, leadership, invention, and authority. Another person
                  might be described through teaching, service, advocacy, care, or being &ldquo;the first
                  woman&rdquo; to do something.
                </p>
                <p>
                  This website turns many biographies into dots on a map so we can look for patterns. Each
                  dot is one biography. If two dots are close together, it means those biographies use
                  similar wording.
                </p>
                <p>
                  The goal is not to judge one person or one biography as &ldquo;bad.&rdquo; The goal is to
                  look across many biographies and ask:
                </p>
                <p>
                  <strong>
                    What kinds of language appear more often around women-labeled biographies? What kinds
                    of language appear more often around men-labeled biographies?
                  </strong>
                </p>
              </article>

              <article id="faq-findings" className="faq-section">
                <h3>What are the findings?</h3>
                <p>
                  The main finding is that the biographies do not appear randomly written. There are
                  repeated patterns in how people are described.
                </p>
                <p>
                  In this dataset, some language patterns appear more often around women-labeled
                  biographies, and some appear more often around men-labeled biographies.
                </p>
                <p>For example, women-labeled biographies more often show frames connected to:</p>
                <ul className="faq-list">
                  <li>current research focus</li>
                  <li>education and teaching</li>
                  <li>care, health, psychology, or social support</li>
                  <li>advocacy, justice, access, and inclusion</li>
                  <li>being a &ldquo;first&rdquo; or representing participation in a field</li>
                </ul>
                <p>Men-labeled biographies more often show frames connected to:</p>
                <ul className="faq-list">
                  <li>senior titles and prestige</li>
                  <li>fellowships, academies, and awards</li>
                  <li>leadership and command roles</li>
                  <li>technical authority</li>
                  <li>older historical legacy</li>
                  <li>business, state, war, or institutional power</li>
                </ul>
                <p>
                  This does <strong>not</strong> mean every woman is written one way or every man is written
                  another way. It also does <strong>not</strong> prove that any individual author intended
                  to be biased.
                </p>
                <p>Instead, the finding is about repeated public writing patterns:</p>
                <p>
                  <strong>
                    When many biographies are placed side by side, gendered patterns of recognition,
                    authority, care, service, and legacy begin to appear.
                  </strong>
                </p>
              </article>

              <article id="faq-methodology" className="faq-section">
                <h3>Why trust this project?</h3>
                <h4 className="faq-subheading">Dataset</h4>
                <p>
                  This site visualizes about 79,680 public biographies drawn from academic and
                  Wikipedia-style sources. Each point keeps metadata such as field, career type, dates,
                  and the gender label listed in the source record.
                </p>
                <h4 className="faq-subheading">Masking</h4>
                <p>
                  Names and other identifying details are masked in the biography text shown on the site.
                  The analysis focuses on recurring language patterns across many biographies, not on
                  calling out one person.
                </p>
                <h4 className="faq-subheading">Embeddings</h4>
                <p>
                  Each biography is converted into a language embedding using MPNet. Similar texts are
                  placed near each other in 3D, which is why clusters on the map represent shared wording
                  rather than random scatter.
                </p>
                <h4 className="faq-subheading">Limitations</h4>
                <p>Please read the patterns with these limits in mind:</p>
                <ul className="faq-list">
                  <li>
                    Patterns are <strong>correlational</strong>. They do not prove that any writer intended
                    to be biased.
                  </li>
                  <li>
                    Gender is treated as a <strong>binary label</strong> as listed in the source data,
                    which does not capture the full range of identity.
                  </li>
                  <li>
                    Public biographies over-represent certain fields, eras, and Wikipedia-style writing,
                    so the map reflects those sources—not all of history.
                  </li>
                  <li>
                    Phrase and frame lists come from a classifier. They highlight wording that statistically
                    co-occurs with labels, not words that are inherently good or bad.
                  </li>
                </ul>
                <h4 className="faq-subheading">Sources and downloads</h4>
                <p>
                  CSV files, frame definitions, and point-level explanations are available in the
                  project&apos;s GitHub repository (see the data table below). For questions about
                  additional research files, email{" "}
                  <a href="mailto:sanskritisingh0914@gmail.com">sanskritisingh0914@gmail.com</a>.
                </p>
              </article>

              <article className="faq-section">
                <h3>Who would want to explore this website?</h3>
                <p>This website is for anyone interested in how language shapes public memory.</p>
                <p>That could include:</p>
                <ul className="faq-list">
                  <li>students studying gender, media, history, or data</li>
                  <li>teachers who want to show how bias can appear in writing</li>
                  <li>researchers interested in representation</li>
                  <li>people curious about Wikipedia-style biographies</li>
                  <li>anyone who wants to understand how women and men are framed differently in public information</li>
                </ul>
                <p>
                  You do not need to know coding, machine learning, or statistics to use this site. The map
                  is meant to help people visually explore patterns that would be hard to notice by reading
                  hundreds or thousands of biographies one by one.
                </p>
              </article>

              <article className="faq-section">
                <h3>How can I get access to the data CSV?</h3>
                <p>
                  If you want the data, you can access the public CSV files through the project&apos;s
                  GitHub repository. The <code>public/data/</code> folder contains all the files:
                </p>
                <div className="faq-data-table" role="region" aria-label="Available data files">
                  <div className="faq-data-row">
                    <a
                      href="https://github.com/Sanskriti-Slngh/Coded-Language-How-Gender-Shapes-Biography/blob/main/public/data/mpnet_local_3d_website_points.csv.gz"
                      target="_blank"
                      rel="noreferrer"
                    >
                      mpnet_local_3d_website_points.csv.gz
                    </a>
                    <span>All data points with info about the (un)masked biographies + gender (79,680 points)</span>
                  </div>
                  <div className="faq-data-row">
                    <a
                      href="https://github.com/Sanskriti-Slngh/Coded-Language-How-Gender-Shapes-Biography/blob/main/public/data/mpnet_local_3d_website_points_mobile.csv.gz"
                      target="_blank"
                      rel="noreferrer"
                    >
                      mpnet_local_3d_website_points_mobile.csv.gz
                    </a>
                    <span>Smaller section of data (1,000 points)</span>
                  </div>
                  <div className="faq-data-row">
                    <a
                      href="https://github.com/Sanskriti-Slngh/Coded-Language-How-Gender-Shapes-Biography/blob/main/public/data/point_explanations_data_driven_buckets.csv.gz"
                      target="_blank"
                      rel="noreferrer"
                    >
                      point_explanations_data_driven_buckets.csv.gz
                    </a>
                    <span>Words/phrases that push the biography toward its real label of man or woman</span>
                  </div>
                  <div className="faq-data-row">
                    <a
                      href="https://github.com/Sanskriti-Slngh/Coded-Language-How-Gender-Shapes-Biography/blob/main/public/data/point_frames_and_similar_profiles.csv.gz"
                      target="_blank"
                      rel="noreferrer"
                    >
                      point_frames_and_similar_profiles.csv.gz
                    </a>
                    <span>Strongest frames visible in the biography regardless of real gender</span>
                  </div>
                  <div className="faq-data-row">
                    <a
                      href="https://github.com/Sanskriti-Slngh/Coded-Language-How-Gender-Shapes-Biography/blob/main/public/data/public_frame_definitions.csv"
                      target="_blank"
                      rel="noreferrer"
                    >
                      public_frame_definitions.csv
                    </a>
                    <span>Definitions of all available frames in the data</span>
                  </div>
                </div>
                <p>
                  If you&apos;d like the files that helped develop this data, please reach out directly
                  via email:{" "}
                  <a href="mailto:sanskritisingh0914@gmail.com">sanskritisingh0914@gmail.com</a>
                </p>
              </article>

              <article className="faq-section">
                <h3>What is Raw vs. Local? Why do they exist?</h3>
                <p>The map has two ways to color the dots.</p>

                <h4 className="faq-subheading">Raw view</h4>
                <p>Raw view shows the original gender label of each biography.</p>
                <p>In this view:</p>
                <ul className="faq-list">
                  <li>one color represents women-labeled biographies</li>
                  <li>one color represents men-labeled biographies</li>
                </ul>
                <p>
                  This helps you see where women-labeled and men-labeled biographies appear in the overall
                  map.
                </p>
                <p>
                  <strong>Raw view answers:</strong> Where are the women-labeled and men-labeled biographies
                  in the full map?
                </p>

                <h4 className="faq-subheading">Local view</h4>
                <p>Local view asks a slightly different question.</p>
                <p>
                  Instead of only asking what one dot&apos;s label is, it looks at the dots around it.
                </p>
                <p>
                  So if a biography is surrounded mostly by women-labeled biographies, that area may appear
                  more woman-associated. If it is surrounded mostly by men-labeled biographies, that area may
                  appear more man-associated.
                </p>
                <p>
                  <strong>Local view answers:</strong> What kind of gender pattern exists in this
                  neighborhood of similar biographies?
                </p>
                <p>
                  In a perfect world our map would be gray, as most biographies would have an equal number
                  of men and women in their surrounding space.
                </p>

                <h4 className="faq-subheading">Why have both?</h4>
                <p>Raw view tells you the actual labels.</p>
                <p>Local view helps you see patterns in the surrounding language.</p>
                <p>
                  For example, a woman-labeled biography might appear in a mostly man-associated
                  neighborhood if its wording is similar to many men-labeled biographies. Or a man-labeled
                  biography might appear in a woman-associated neighborhood if its wording uses frames
                  more common around women-labeled biographies.
                </p>
                <p>Together, Raw and Local help you separate two questions:</p>
                <p>
                  <strong>Who is labeled woman or man?</strong>
                  <br />
                  and
                  <br />
                  <strong>What kinds of language surround this biography?</strong>
                </p>
              </article>

              <article className="faq-section">
                <h3>What should I look for?</h3>
                <p>Start by looking for clusters.</p>
                <p>
                  A cluster is a group of dots that sit close together. That means the biographies in that
                  area use similar language.
                </p>
                <p>Then ask:</p>
                <ul className="faq-list">
                  <li>
                    <strong>Who is in this cluster?</strong> Are the nearby biographies mostly
                    women-labeled, mostly men-labeled, or mixed?
                  </li>
                  <li>
                    <strong>What kind of language appears there?</strong> Click a dot and look at the
                    phrases, frames, and similar biographies.
                  </li>
                  <li>
                    <strong>Are people being described through authority, invention, leadership, care,
                    teaching, advocacy, awards, or legacy?</strong>
                  </li>
                  <li>
                    <strong>Do women and men appear in similar areas, or do they form different
                    neighborhoods?</strong>
                  </li>
                  <li>
                    <strong>Are there exceptions?</strong> Some biographies may not follow the larger
                    pattern. These are interesting because they show that gendered language is not
                    automatic or fixed.
                  </li>
                </ul>
                <p>The most important thing is not one dot. The important thing is the pattern across many dots.</p>
                <p>
                  <strong>
                    Look for where biographies cluster, click the dots, and ask what kind of public story is
                    being told about each person.
                  </strong>
                </p>
              </article>
            </div>
          </div>
        </section>
      )}

      {!isPointSelected && (
        <div
          className="explore-sidebar"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className={`faq-floating-button${
              isEntered && !hasDismissedFaqGlow ? " is-glowing" : ""
            }`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setIsFaqOpen(true);
            }}
          >
            What am I looking at?
          </button>

          <aside
            className="explore-filters"
            aria-label="Explore biography filters"
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
              value={searchDraft}
              onChange={(event) => updateSearch(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder='Try: Ada chemist, "named awards", mathematics...'
            />
            <span className="filter-search-help">
              Press Enter or Search to update the visible cluster.
            </span>
          </label>

          <div className="filter-search-actions">
            <button
              type="button"
              className="filter-search-button"
              disabled={!isSearchPending}
              onClick={() => applySearch()}
            >
              Search
            </button>

            <button
              type="button"
              className="filter-search-button secondary"
              disabled={searchDraft.trim().length === 0 && filters.search.trim().length === 0}
              onClick={clearSearch}
            >
              Clear search
            </button>
          </div>

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
            disabled={!hasActiveFilters && searchDraft.trim().length === 0}
            onClick={clearFilters}
          >
            Clear filters
          </button>
          </aside>
        </div>
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
      </div>
    </main>
  );
}

export default App;
