import { useState } from 'react';
import { Check, Copy, KeyRound, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { INVITE_VALID_DAYS, type InviteLink } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/format';
import { useInvite, usePublicLanding } from '@/lib/queries';

interface Props {
  member: { id: number; name: string; phone: string };
  /** The member's app login already exists, so this link will reset their password. */
  isReset?: boolean;
  justAdded?: boolean;
  onClose: () => void;
}

/**
 * Gives a member a one-time link to set their own password. The owner shares it by WhatsApp or any
 * other way. No password is ever chosen for, or shown to, the member by the owner.
 */
export function InviteDialog({ member, isReset, justAdded, onClose }: Props) {
  const invite = useInvite(member.id);
  const { data: landing } = usePublicLanding();
  const [link, setLink] = useState<InviteLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const url = link ? `${window.location.origin}/activate/${link.token}` : '';
  const firstName = member.name.split(' ')[0];
  const gym = landing?.gym.gym_name ?? 'the gym';
  const message = `Hi ${firstName}, here is your ${gym} member sign-in link: ${url}\nIt works once and expires in ${INVITE_VALID_DAYS} days. Open it to choose your password.`;

  async function create() {
    setError('');
    try {
      setLink(await invite.mutateAsync());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the link.');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select the link and copy it by hand.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{justAdded ? `${member.name} was added` : isReset ? 'Password reset link' : 'Invite to the app'}</DialogTitle>
          <DialogDescription>
            {isReset
              ? `Create a link ${firstName} can use to choose a new password. Their old password stops working once they do.`
              : `Create a sign-in link so ${firstName} can see their membership, reminders and offers. They choose their own password.`}
          </DialogDescription>
        </DialogHeader>

        {!link ? (
          <div className="grid gap-3">
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button onClick={create} disabled={invite.isPending}>
              <KeyRound aria-hidden /> {invite.isPending ? 'Creating…' : 'Create sign-in link'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Creating a new link cancels any earlier one for this member. They sign in with their mobile number ({member.phone.slice(-10)}).
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-url">Sign-in link</Label>
              <Input id="invite-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              <p className="text-sm text-muted-foreground">
                Works once. Expires on {formatDate(link.expires_at.slice(0, 10))}. Anyone with this link can set the password, so send it only to {firstName}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copy}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button asChild>
                <a href={`https://wa.me/${member.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
                  <MessageCircle aria-hidden /> Send on WhatsApp
                </a>
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{link ? 'Done' : justAdded ? 'Not now' : 'Cancel'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
