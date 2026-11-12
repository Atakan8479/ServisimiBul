import { useLocation } from 'react-router-dom'
import schoolBusTop from '../assets/school-bus-top.svg'

export function RoadBackdrop() {
  // The minibuses drive only on the homepage; other pages keep the quiet road.
  const showMinibuses = useLocation().pathname === '/'
  return (
    <div className="road-backdrop" aria-hidden="true">
      <span className="road-lane road-lane-one">
        {showMinibuses && (
          <span className="road-minibus road-minibus-one">
            <img src={schoolBusTop} alt="" />
          </span>
        )}
      </span>
      <span className="road-lane road-lane-two">
        {showMinibuses && (
          <span className="road-minibus road-minibus-two">
            <img src={schoolBusTop} alt="" />
          </span>
        )}
      </span>
    </div>
  )
}
