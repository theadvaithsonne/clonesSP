/**
 * The front-page hero: the office drawn as a building section.
 *
 * This is the one thing about Garage that no other workspace product has —
 * people are *somewhere*, on a floor, in a room — so the manual opens with it
 * rather than with a headline. Hairlines and plan markers, one amber arc for
 * the knock happening on floor 02.
 *
 * Geometry: every x below is an offset inside the slab, 0 at the left wall.
 * `at()` moves it into the drawing's coordinates, so the label margin can be
 * widened without touching a single occupant.
 */

const MARGIN = 84; // left wall — everything sits to the right of the floor labels
const SLAB = 368; // slab width
const BAND = 62; // floor-to-floor
const TOP = 16;

const at = (x: number) => MARGIN + x;

const FLOORS = [
  {
    name: "Floor 03",
    tag: "Design",
    rooms: [{ x: 156, w: 92, label: "Studio" }],
    people: [14, 32, 50, 104, 122, 268, 286, 304, 340, 358],
  },
  {
    name: "Floor 02",
    tag: "Engineering",
    rooms: [{ x: 228, w: 98, label: "Standup" }],
    people: [14, 32, 50, 68, 120, 138, 156, 174, 340, 358],
    knock: [50, 138] as [number, number],
  },
  {
    name: "Floor 01",
    tag: "Revenue",
    rooms: [{ x: 84, w: 84, label: "Pitch" }],
    people: [14, 32, 190, 208, 226, 262, 280, 322, 340, 358],
  },
  {
    name: "Lobby",
    tag: "arrivals",
    rooms: [],
    people: [14, 32, 50, 68, 86, 162, 180, 198, 276, 294, 312, 340, 358],
  },
];

export default function OfficeSection() {
  const ground = TOP + FLOORS.length * BAND;

  return (
    <svg
      className="doc-hero-svg"
      viewBox={`0 0 500 ${ground + 18}`}
      role="img"
      aria-label="A cut-through of a Garage office: three floors above a lobby, with people standing in departments and meeting rooms, and one person knocking on another on floor two."
    >
      <defs>
        <pattern
          id="doc-hatch"
          width="5"
          height="5"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="5" stroke="#272b39" strokeWidth="1" />
        </pattern>
      </defs>

      {FLOORS.map((floor, i) => {
        const y = TOP + i * BAND;
        const feet = y + BAND - 14; // where people stand
        return (
          <g key={floor.name}>
            {/* Slab */}
            <line x1={at(0)} y1={y} x2={at(SLAB)} y2={y} stroke="#272b39" strokeWidth="1" />
            <rect x={at(0)} y={y} width={SLAB} height="4" fill="url(#doc-hatch)" opacity="0.8" />

            {/* Floor label, in the drawing's left margin */}
            <text x={at(0) - 12} y={y + 26} textAnchor="end" className="doc-hero-label">
              {floor.name}
            </text>
            <text x={at(0) - 12} y={y + 38} textAnchor="end" className="doc-hero-sub">
              {floor.tag}
            </text>

            {/* Rooms: outlined volumes sitting on the slab */}
            {floor.rooms.map((room) => (
              <g key={room.label}>
                <rect
                  x={at(room.x)}
                  y={y + 12}
                  width={room.w}
                  height={BAND - 22}
                  fill="none"
                  stroke="#363c4d"
                  strokeWidth="1"
                />
                <text x={at(room.x) + 7} y={y + 24} className="doc-hero-room">
                  {room.label}
                </text>
                {[0, 1, 2].map((n) => (
                  <circle
                    key={n}
                    cx={at(room.x) + 14 + n * 14}
                    cy={feet}
                    r="3"
                    fill="#969cb0"
                  />
                ))}
              </g>
            ))}

            {/* People */}
            {floor.people.map((x) => (
              <circle key={x} cx={at(x)} cy={feet} r="3" fill="#656b7e" />
            ))}

            {/* The knock */}
            {floor.knock && (
              <g>
                <path
                  d={`M ${at(floor.knock[0])} ${feet - 5} Q ${
                    at((floor.knock[0] + floor.knock[1]) / 2)
                  } ${feet - 30} ${at(floor.knock[1])} ${feet - 5}`}
                  fill="none"
                  stroke="#f2a93b"
                  strokeWidth="1.1"
                />
                <circle cx={at(floor.knock[0])} cy={feet} r="3.6" fill="#f2a93b" />
                <circle
                  cx={at(floor.knock[1])}
                  cy={feet}
                  r="5"
                  fill="none"
                  stroke="#f2a93b"
                  strokeWidth="1.1"
                />
                <text
                  x={at((floor.knock[0] + floor.knock[1]) / 2)}
                  y={feet - 24}
                  textAnchor="middle"
                  className="doc-hero-knock"
                >
                  knock
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Ground */}
      <line x1={at(0)} y1={ground} x2={at(SLAB)} y2={ground} stroke="#f2a93b" strokeWidth="1" />

      {/* Dimension: the whole stack is one organisation */}
      <g stroke="#363c4d" strokeWidth="1">
        <line x1={at(SLAB) + 22} y1={TOP} x2={at(SLAB) + 22} y2={ground} />
        <line x1={at(SLAB) + 17} y1={TOP} x2={at(SLAB) + 27} y2={TOP} />
        <line x1={at(SLAB) + 17} y1={ground} x2={at(SLAB) + 27} y2={ground} />
      </g>
      <text
        x={at(SLAB) + 38}
        y={TOP + (ground - TOP) / 2}
        className="doc-hero-dim"
        transform={`rotate(90 ${at(SLAB) + 38} ${TOP + (ground - TOP) / 2})`}
        textAnchor="middle"
      >
        one organisation
      </text>
    </svg>
  );
}
