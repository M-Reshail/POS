import { GripVertical, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { Modal, Button } from './index';
import { ColumnConfig } from '../../hooks/useReorderableColumns';

interface ColumnManagerModalProps<TKey extends string> {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnConfig<TKey>[];
  moveColumn: (id: TKey, direction: 'left' | 'right') => void;
  resetColumns: () => void;
  isCustomOrder: boolean;
}

export function ColumnManagerModal<TKey extends string>({
  isOpen,
  onClose,
  columns,
  moveColumn,
  resetColumns,
  isCustomOrder,
}: ColumnManagerModalProps<TKey>) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Arrange Table Columns"
      size="sm"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          {isCustomOrder ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={resetColumns}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </Button>
          ) : (
            <div />
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onClose}
            className="px-5 text-xs font-bold"
          >
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <p className="text-xs text-ink-muted mb-3">
          Use the arrow buttons to rearrange column positions. Your preference is automatically saved.
        </p>

        <div className="divide-y divide-border/60 border border-border rounded-card overflow-hidden bg-surface">
          {columns.map((col, index) => {
            const isFirst = index === 0;
            const isLast = index === columns.length - 1;
            const isReorderable = col.reorderable !== false;

            return (
              <div
                key={col.id}
                className="flex items-center justify-between p-2.5 hover:bg-surface-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isReorderable ? (
                    <span className="text-ink-subtle/70">
                      <GripVertical size={14} />
                    </span>
                  ) : (
                    <span className="w-3.5" />
                  )}
                  <span className="text-xs font-semibold text-ink-subtle w-4">
                    {index + 1}.
                  </span>
                  <span className="text-xs font-bold text-ink truncate">
                    {col.label}
                  </span>
                </div>

                {isReorderable && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => moveColumn(col.id, 'left')}
                      disabled={isFirst || columns[index - 1]?.reorderable === false}
                      title="Move up (earlier)"
                      className="w-7 h-7 rounded-control flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveColumn(col.id, 'right')}
                      disabled={isLast || columns[index + 1]?.reorderable === false}
                      title="Move down (later)"
                      className="w-7 h-7 rounded-control flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
