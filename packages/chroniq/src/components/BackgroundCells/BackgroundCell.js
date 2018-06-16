import React from 'react'
import dates from '../../utils/dates'

import { classNames, compose } from '../../utils/helpers'
import { get, length } from '@chroniq/chroniq-accessor-helpers'

import { DropTarget } from 'react-dnd'

import { connect } from '../../store/connect'
import { makeCanDrop, makeGetHighlightEventsForResourcesAndRange } from '../../selectors/highlightEvents'
import { onEventDrag, onEventResizing } from '../../store/actions'

class BackgroundCell extends React.PureComponent {
  render () {
    const { connectDropTarget, wrapper: Wrapper, date, resources, selected, currentDate, redux: { previewIntensity } } = this.props

    return (
      <Wrapper
        value={date}
        resources={resources}
      >
        {
          connectDropTarget(
            <div
              style={{
                flex: '0 1 100%',
                background: `rgba(200, 200, 200, ${1 - Math.pow(1.5, -previewIntensity)})`
              }}
              className={classNames(
                'chrnq-day-bg',
                selected && 'chrnq-selected-cell',
                dates.isToday(date) && 'chrnq-today',
                currentDate && dates.month(currentDate) !== dates.month(date) && 'chrnq-off-range-bg',
              )}
            />
          )
        }
      </Wrapper>
    )
  }
}

const calcHoveredTime = (monitor, accessors, date) => {
  const eventStart = get(monitor.getItem(), monitor.getItemType() === 'drag' ? accessors.event.start : accessors.event.end)

  return dates.merge(date, eventStart)
}

const dropTargetSpec = {
  drop ({ date, accessors, resources }, monitor, component) {
    const event = monitor.getItem()
    const currentlyHoveredTime = calcHoveredTime(monitor, accessors, date)

    if (monitor.getItemType() === 'drag') {
      const eventStartEndDiff = dates.diff(
        get(event, accessors.event.start),
        get(event, accessors.event.end),
        'minutes',
        true
      )

      return {
        start: currentlyHoveredTime,
        end: dates.add(currentlyHoveredTime, eventStartEndDiff, 'minutes'),
        resourceId: length(resources) === 1
          ? get(resources[0], accessors.resource.id)
          : 'multiple'
      }
    } else {
      return {
        start: get(event, accessors.event.start),
        end: currentlyHoveredTime
      }
    }
  },

  hover ({ date, accessors, resources, redux: { onEventDrag, onEventResizing } }, monitor, component) {
    if (!monitor.canDrop()) {
      return
    }

    const event = monitor.getItem()
    const currentlyHoveredTime = calcHoveredTime(monitor, accessors, date)

    if (monitor.getItemType() === 'drag') {
      const eventStartEndDiff = dates.diff(
        get(event, accessors.event.start),
        get(event, accessors.event.end),
        'minutes',
        true
      )

      onEventDrag({
        start: currentlyHoveredTime,
        end: dates.add(currentlyHoveredTime, eventStartEndDiff, 'minutes'),
        resourceId: length(resources) === 1
          ? get(resources[0], accessors.resource.id)
          : 'multiple'
      })
    } else {
      if (!dates.lt(get(event, accessors.event.start), currentlyHoveredTime)) {
        return
      }

      onEventResizing({
        start: get(event, accessors.event.start),
        end: currentlyHoveredTime,
        resourceId: length(resources) === 1
          ? get(resources[0], accessors.resource.id)
          : 'multiple'
      })
    }
  },

  canDrop ({ isLegend, accessors, resources, date, redux: { canDrop } }, monitor, component) {
    if (isLegend) {
      return false
    }

    if (monitor.getItemType() === 'resize') {
      const event = monitor.getItem()
      if (!resources.some((resource) => get(resource, accessors.resource.id) === event.resourceId)) {
        return false
      }

      return true
    } else {
      return canDrop
    }

    return true
  }
}

const dropTargetCollect = (connect, monitor) => ({
  connectDropTarget: connect.dropTarget()
})

const makeMapStateToProps = () => {
  const canDrop = makeCanDrop()
  const getHighlightEventsForResourcesAndRange = makeGetHighlightEventsForResourcesAndRange()

  const mapStateToProps = (state, props) => {

    return {
      canDrop: canDrop(state, props.resources, props.accessors),
      previewIntensity: props.monthView && getHighlightEventsForResourcesAndRange(state, props.resources, {
        ...props.accessors,
        highlightEvent: {
          start: 'from',
          end: 'to',
          resourceId: 'resourceId'
        }
      }, [
        dates.startOf(props.date, 'day'),
        dates.endOf(props.date, 'day')
      ]).length
    }
  }

  return mapStateToProps
}

const mapDispatchToProps = {
  onEventDrag,
  onEventResizing
}

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  redux: {
    ...stateProps,
    ...dispatchProps
  }
})

export default compose(
  connect(makeMapStateToProps, mapDispatchToProps, mergeProps, {
    areStatesEqual: (a, b) => a.get('dnd') === b.get('dnd')
  }),
  DropTarget([ 'drag', 'resize' ], dropTargetSpec, dropTargetCollect)
)(BackgroundCell)
