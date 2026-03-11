'use client';

import { useState } from 'react';
import type { WireDefinition, WireStage } from '@tomachina/core';

const STAGE_CONFIG: Record<string, { icon: string; color: string }> = {
  EXTERNAL:     { icon: 'cloud',          color: 'rgb(168, 85, 247)' },
  MCP_TOOL:     { icon: 'hub',            color: 'rgb(6, 182, 212)' },
  GAS_FUNCTION: { icon: 'code',           color: 'rgb(245, 158, 11)' },
  API_ENDPOINT: { icon: 'api',            color: 'rgb(59, 130, 246)' },
  MATRIX_TAB:   { icon: 'storage',        color: 'rgb(16, 185, 129)' },
  FRONTEND:     { icon: 'monitor',        color: 'rgb(20, 184, 166)' },
  LAUNCHD:      { icon: 'schedule',       color: 'rgb(249, 115, 22)' },
  SCRIPT:       { icon: 'terminal',       color: 'rgb(99, 102, 241)' },
};

function getConfig(type: string) {
  return STAGE_CONFIG[type] ?? { icon: 'help_outline', color: 'rgb(148, 163, 184)' };
}

/* ─── Single Wire Diagram ─── */

interface WireDiagramProps {
  wire: WireDefinition;
  onStageClick?: (stage: WireStage) => void;
}

export function WireDiagram({ wire, onStageClick }: WireDiagramProps) {
  const stages: WireStage[] = wire.stages ?? [];

  return (
    <div style={{
      background: 'var(--bg-card, #1e293b)',
      border: '1px solid var(--border-subtle, #334155)',
      borderRadius: '0.75rem',
      padding: '1.25rem',
    }}>
      <h3 style={{
        color: 'var(--text-primary, #f1f5f9)',
        fontSize: '0.9rem',
        fontWeight: 600,
        margin: '0 0 0.25rem',
      }}>
        {wire.name}
      </h3>
      <p style={{
        color: 'var(--text-muted, #94a3b8)',
        fontSize: '0.75rem',
        margin: '0 0 1rem',
      }}>
        {wire.product_line} &middot; {wire.data_domain}
      </p>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        overflowX: 'auto',
        paddingBottom: '0.5rem',
      }}>
        {stages.map((stage, i) => {
          const cfg = getConfig(stage.type);
          return (
            <div key={stage.name + i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {/* Stage Card */}
              <button
                type="button"
                onClick={() => onStageClick?.(stage)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.75rem 1rem',
                  minWidth: '7rem',
                  background: 'var(--bg-card, #1e293b)',
                  border: `1px solid ${cfg.color}44`,
                  borderRadius: '0.5rem',
                  cursor: onStageClick ? 'pointer' : 'default',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = cfg.color;
                  e.currentTarget.style.boxShadow = `0 0 12px ${cfg.color}33`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = `${cfg.color}44`;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span
                  className="material-icons-outlined"
                  style={{ fontSize: '1.5rem', color: cfg.color }}
                >
                  {cfg.icon}
                </span>
                <span style={{
                  color: 'var(--text-primary, #f1f5f9)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}>
                  {stage.name}
                </span>
                {stage.detail && (
                  <span style={{
                    color: 'var(--text-muted, #94a3b8)',
                    fontSize: '0.625rem',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    maxWidth: '6.5rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {stage.detail}
                  </span>
                )}
              </button>

              {/* Arrow connector */}
              {i < stages.length - 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 0.15rem',
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: '1.5rem',
                    height: '2px',
                    background: 'var(--border-subtle, #475569)',
                  }} />
                  <div style={{
                    width: 0,
                    height: 0,
                    borderTop: '5px solid transparent',
                    borderBottom: '5px solid transparent',
                    borderLeft: '7px solid var(--border-subtle, #475569)',
                  }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Wire Diagram List ─── */

interface WireDiagramListProps {
  wires: WireDefinition[];
  onStageClick?: (stage: WireStage) => void;
}

export function WireDiagramList({ wires, onStageClick }: WireDiagramListProps) {
  const [selected, setSelected] = useState<string>('__all__');
  const visible = selected === '__all__' ? wires : wires.filter(w => w.name === selected);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {wires.length > 1 && (
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{
            alignSelf: 'flex-start',
            padding: '0.5rem 0.75rem',
            background: 'var(--bg-card, #1e293b)',
            color: 'var(--text-primary, #f1f5f9)',
            border: '1px solid var(--border-subtle, #334155)',
            borderRadius: '0.375rem',
            fontSize: '0.8rem',
          }}
        >
          <option value="__all__">All Wires ({wires.length})</option>
          {wires.map(w => (
            <option key={w.name} value={w.name}>{w.name}</option>
          ))}
        </select>
      )}
      {visible.map(w => (
        <WireDiagram key={w.name} wire={w} onStageClick={onStageClick} />
      ))}
    </div>
  );
}
