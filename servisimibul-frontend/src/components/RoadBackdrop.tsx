import schoolBusTop from '../assets/school-bus-top.svg'

export function RoadBackdrop() {
  return (
    <div className="road-backdrop" aria-hidden="true">
      <span className="road-lane road-lane-one">
        <span className="road-minibus road-minibus-one">
          <img src={schoolBusTop} alt="" />
        </span>
      </span>
      <span className="road-lane road-lane-two">
        <span className="road-minibus road-minibus-two">
          <img src={schoolBusTop} alt="" />
        </span>
      </span>
    </div>
  )
}
