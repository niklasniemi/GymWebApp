import { useUI } from '../../store/ui';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';

/** Renders the promise-based `confirm()` dialog. */
export function ConfirmHost() {
  const req = useUI((s) => s.confirmRequest);
  return (
    <Sheet
      open={Boolean(req)}
      onClose={() => req?.resolve(false)}
      title={req?.title ?? ''}
      description={req?.message}
      footer={
        <div className="flex gap-2">
          <Button block onClick={() => req?.resolve(false)}>
            {req?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            block
            data-autofocus
            variant={req?.destructive ? 'danger' : 'primary'}
            feedback={req?.destructive ? 'warning' : 'tap'}
            onClick={() => req?.resolve(true)}
          >
            {req?.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      }
    >
      {null}
    </Sheet>
  );
}
