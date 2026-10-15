export function RoadBackdrop() {
  return (
    <div className="road-backdrop" aria-hidden="true">
      <span className="road-lane road-lane-one">
        <span className="road-minibus road-minibus-one">
          <SchoolMinibus />
        </span>
      </span>
      <span className="road-lane road-lane-two">
        <span className="road-minibus road-minibus-two">
          <SchoolMinibus />
        </span>
      </span>
    </div>
  )
}

function SchoolMinibus() {
  return (
    <svg viewBox="0 0 180 76" focusable="false">
      <rect
        className="minibus-wheel"
        x="42"
        y="3"
        width="30"
        height="7"
        rx="3"
      />
      <rect
        className="minibus-wheel"
        x="42"
        y="66"
        width="30"
        height="7"
        rx="3"
      />
      <rect
        className="minibus-wheel"
        x="120"
        y="3"
        width="30"
        height="7"
        rx="3"
      />
      <rect
        className="minibus-wheel"
        x="120"
        y="66"
        width="30"
        height="7"
        rx="3"
      />
      <path
        className="minibus-body"
        d="M17 12C23 5 34 3 48 3h93c18 0 29 10 34 27v16c-5 17-16 27-34 27H48c-14 0-25-2-31-9L6 52V24L17 12Z"
      />
      <path
        className="minibus-windshield"
        d="m135 11 22 7 9 15v10l-9 15-22 7-7-10V21l7-10Z"
      />
      <path
        className="minibus-rear-window"
        d="M23 17c5-4 13-6 24-6h5v54h-5c-11 0-19-2-24-6L14 49V27l9-10Z"
      />
      <rect
        className="minibus-roof"
        x="59"
        y="12"
        width="64"
        height="52"
        rx="10"
      />
      <path
        className="minibus-window"
        d="M65 17h22v18H65zM94 17h23v18H94zM65 41h22v18H65zM94 41h23v18H94z"
      />
      <path className="minibus-door" d="M124 16v44" />
      <circle className="minibus-light" cx="169" cy="22" r="3" />
      <circle className="minibus-light" cx="169" cy="54" r="3" />
      <path className="minibus-mirror" d="M137 6h12M137 70h12" />
    </svg>
  )
}
