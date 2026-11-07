import React, { useState } from 'react';
import { FiBell } from 'react-icons/fi';
import { useMonitoring } from '../context/MonitoringContext';
import { EmptyState, ErrorMessage, LoadingState, PageHeading, StatusBadge } from '../components/UI';
import AlertCard from '../components/AlertCard';

export default function Alerts() {
  const { alerts, alertsLoading, alertsError, refreshAlerts } = useMonitoring();
  const [filter, setFilter] = useState('all');
  const shown = alerts.filter(alert => filter === 'all' || alert.tone === filter);
  return <>
    <PageHeading eyebrow="BOUNDARY ACTIVITY" title="Stay aware of every crossing" description="Review saved vehicle entries and exits for your geofences.">
      <StatusBadge tone="info">Saved history</StatusBadge>
    </PageHeading>
    <section className="panel">
      <div className="panel-heading">
        <div><h2>Boundary events <span className="count-label">{alerts.length}</span></h2><p>Most recent first · Up to 100 events loaded</p></div>
        <div className="filter-group" role="group" aria-label="Filter alerts">
          {[['all', 'All events'], ['warning', 'Exits'], ['safe', 'Entries']].map(([value, label]) => <button key={value} className={filter === value ? 'selected' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
      </div>
      <ErrorMessage onRetry={refreshAlerts}>{alertsError}</ErrorMessage>
      <div className="panel-body">
        {alertsLoading ? <LoadingState label="Loading alert history…" /> : shown.length ? shown.map(alert => <AlertCard key={alert.id} alert={alert} />) : <EmptyState icon={FiBell} title={alerts.length ? 'No events match this filter' : 'No boundary events yet'}>{alerts.length ? 'Choose another filter to view activity.' : 'Saved events appear when real device positions cross an active geofence.'}</EmptyState>}
      </div>
    </section>
  </>;
}
