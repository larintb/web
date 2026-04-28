'use client';

import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?:  React.ComponentType;
    color?: string;
  };
};

const THEMES = { light: '', dark: '.dark' } as const;

type ChartContextProps = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error('useChart must be used inside <ChartContainer />');
  return ctx;
}

// ─── ChartStyle ────────────────────────────────────────────────────────────

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, c]) => c.color);
  if (!colorConfig.length) return null;
  return (
    <style dangerouslySetInnerHTML={{
      __html: Object.entries(THEMES).map(([, prefix]) =>
        `${prefix} [data-chart="${id}"] { ${colorConfig.map(([key, c]) =>
          c.color ? `--color-${key}: ${c.color};` : ''
        ).join(' ')} }`
      ).join('\n'),
    }} />
  );
}

// ─── ChartContainer ────────────────────────────────────────────────────────

type ChartContainerProps = React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
};

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ id, className, children, config, ...props }, ref) => {
    const uid     = React.useId();
    const chartId = `chart-${id || uid.replace(/:/g, '')}`;

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          data-chart={chartId}
          ref={ref}
          className={cn(
            'flex justify-center text-xs',
            '[&_.recharts-cartesian-axis-tick_text]:fill-[#8c7b65]',
            '[&_.recharts-cartesian-grid_line]:stroke-[rgba(232,216,198,0.6)]',
            '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-[rgba(232,216,198,0.8)]',
            '[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-[rgba(246,241,232,0.7)]',
            '[&_.recharts-layer]:outline-none',
            '[&_.recharts-surface]:outline-none',
            className,
          )}
          {...props}
        >
          <ChartStyle id={chartId} config={config} />
          <RechartsPrimitive.ResponsiveContainer>
            {children}
          </RechartsPrimitive.ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    );
  }
);
ChartContainer.displayName = 'ChartContainer';

// ─── ChartTooltip ──────────────────────────────────────────────────────────

const ChartTooltip = RechartsPrimitive.Tooltip;

// Recharts passes these props to custom tooltip content via `content` prop
interface TooltipPayloadItem {
  dataKey?:  string | number;
  name?:     string | number;
  value?:    unknown;
  color?:    string;
  payload?:  Record<string, unknown>;
  fill?:     string;
}

interface ChartTooltipContentProps extends React.ComponentProps<'div'> {
  active?:        boolean;
  payload?:       TooltipPayloadItem[];
  label?:         string | number;
  labelFormatter?: (label: unknown, payload: TooltipPayloadItem[]) => React.ReactNode;
  labelClassName?: string;
  formatter?:     (value: unknown, name: string, item: TooltipPayloadItem, index: number) => React.ReactNode;
  color?:         string;
  hideLabel?:     boolean;
  hideIndicator?: boolean;
  indicator?:     'line' | 'dot' | 'dashed';
  nameKey?:       string;
  labelKey?:      string;
}

const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  ({
    active, payload, className,
    indicator = 'dot',
    hideLabel = false, hideIndicator = false,
    label, labelFormatter, labelClassName,
    formatter, color, nameKey, labelKey,
  }, ref) => {
    const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) return null;
      const [item]     = payload;
      const key        = `${labelKey || item.dataKey || item.name || 'value'}`;
      const itemConfig = getPayloadConfig(config, item, key);
      const value      = !labelKey && typeof label === 'string'
        ? config[label]?.label || label
        : itemConfig?.label;

      if (labelFormatter) return (
        <div className={cn('font-semibold text-[#171717]', labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      );
      if (!value) return null;
      return <div className={cn('font-semibold text-[#171717]', labelClassName)}>{value}</div>;
    }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

    if (!active || !payload?.length) return null;

    const nestLabel = payload.length === 1 && indicator !== 'dot';

    return (
      <div
        ref={ref}
        className={cn(
          'grid min-w-[8rem] items-start gap-1.5 rounded-xl border border-[rgba(232,216,198,0.95)] bg-white px-2.5 py-2 text-xs shadow-lg',
          className,
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key        = `${nameKey || item.name || item.dataKey || 'value'}`;
            const itemConfig = getPayloadConfig(config, item, key);
            const indColor   = color || item.fill || item.payload?.fill as string | undefined || item.color;

            return (
              <div
                key={`${item.dataKey}-${index}`}
                className="flex w-full items-center gap-2"
              >
                {formatter && item.value !== undefined && item.name ? (
                  formatter(item.value, String(item.name), item, index)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : !hideIndicator && (
                      <div
                        className={cn('shrink-0 rounded-[2px]', {
                          'h-2.5 w-2.5':                     indicator === 'dot',
                          'w-1 h-3':                         indicator === 'line',
                          'w-0 border-[1.5px] border-dashed bg-transparent': indicator === 'dashed',
                        })}
                        style={{ backgroundColor: indColor, borderColor: indColor }}
                      />
                    )}
                    <div className="flex flex-1 justify-between leading-none">
                      <div className="grid gap-1">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-[#8c7b65]">{itemConfig?.label || item.name}</span>
                      </div>
                      {item.value !== undefined && (
                        <span className="font-mono font-semibold tabular-nums text-[#171717] ml-3">
                          {typeof item.value === 'number'
                            ? item.value.toLocaleString('es-MX')
                            : String(item.value)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = 'ChartTooltipContent';

// ─── ChartLegend ───────────────────────────────────────────────────────────

const ChartLegend = RechartsPrimitive.Legend;

interface LegendPayloadItem {
  value?:   unknown;
  color?:   string;
  dataKey?: string | number;
}

interface ChartLegendContentProps extends React.ComponentProps<'div'> {
  payload?:       LegendPayloadItem[];
  verticalAlign?: 'top' | 'bottom' | 'middle';
  hideIcon?:      boolean;
  nameKey?:       string;
}

const ChartLegendContent = React.forwardRef<HTMLDivElement, ChartLegendContentProps>(
  ({ className, hideIcon = false, payload, verticalAlign = 'bottom', nameKey }, ref) => {
    const { config } = useChart();
    if (!payload?.length) return null;

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-center gap-4',
          verticalAlign === 'top' ? 'pb-3' : 'pt-3',
          className,
        )}
      >
        {payload.map((item, i) => {
          const key        = `${nameKey || item.dataKey || 'value'}`;
          const itemConfig = getPayloadConfig(config, item, key);

          return (
            <div key={`legend-${i}`} className="flex items-center gap-1.5 text-xs text-[#8c7b65]">
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
              )}
              {itemConfig?.label}
            </div>
          );
        })}
      </div>
    );
  }
);
ChartLegendContent.displayName = 'ChartLegendContent';

// ─── Helper ────────────────────────────────────────────────────────────────

function getPayloadConfig(config: ChartConfig, payload: unknown, key: string) {
  if (typeof payload !== 'object' || payload === null) return undefined;

  const inner = 'payload' in (payload as Record<string, unknown>)
    ? (payload as { payload: unknown }).payload
    : undefined;

  let configKey = key;
  if (!(key in config) && inner && typeof inner === 'object' && key in (inner as object)) {
    const v = (inner as Record<string, unknown>)[key];
    if (typeof v === 'string') configKey = v;
  }

  return configKey in config ? config[configKey] : config[key];
}

// ─── Exports ───────────────────────────────────────────────────────────────

export {
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
};
