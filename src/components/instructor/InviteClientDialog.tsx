import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  UserPlus,
  Loader2,
  Check,
  Clock,
  X,
  Mail,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Invite {
  id: string;
  email: string;
  name: string | null;
  status: string;
  linked_user_id: string | null;
  created_at: string;
}

interface InviteClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteClientDialog({ open, onOpenChange }: InviteClientDialogProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [tab, setTab] = useState<"send" | "history">("send");

  useEffect(() => {
    if (open && user) {
      loadInvites();
    }
  }, [open, user]);

  async function loadInvites() {
    setLoadingInvites(true);
    try {
      const { data, error } = await supabase
        .from("coach_client_invites")
        .select("id, email, name, status, linked_user_id, created_at")
        .eq("coach_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setInvites(data || []);
    } catch (err) {
      console.error("Error loading invites:", err);
    } finally {
      setLoadingInvites(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-coach-invite", {
        body: {
          email: email.trim(),
          name: name.trim() || undefined,
          message: message.trim() || undefined,
        },
      });

      if (error) {
        // Try to extract error message from edge function response
        let errorMsg = "Failed to send invitation";
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.error) errorMsg = body.error;
          }
        } catch { /* ignore */ }
        throw new Error(errorMsg);
      }

      if (data?.already_exists) {
        toast.success(data.message || "Client already exists and has been linked to you.");
      } else {
        toast.success(data?.message || `Invitation sent to ${email.trim()}`);
      }

      setEmail("");
      setName("");
      setMessage("");
      loadInvites();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setSending(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "accepted":
        return (
          <Badge variant="default" className="bg-green-600">
            <Check className="mr-1 h-3 w-3" />
            Accepted
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="destructive">
            <X className="mr-1 h-3 w-3" />
            Declined
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Client
          </DialogTitle>
          <DialogDescription>
            Invite someone to join the platform as your client. If they already have an account,
            they'll be automatically linked to you.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b pb-2">
          <Button
            variant={tab === "send" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab("send")}
          >
            <Send className="mr-1 h-3.5 w-3.5" />
            Send Invite
          </Button>
          <Button
            variant={tab === "history" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab("history")}
          >
            <Mail className="mr-1 h-3.5 w-3.5" />
            History ({invites.length})
          </Button>
        </div>

        {tab === "send" && (
          <form onSubmit={handleSend} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Client Email *</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Client Name (optional)</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-message">Personal Message (optional)</Label>
              <Textarea
                id="invite-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a personal note to include in the invitation email..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={sending || !email.trim()}>
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {tab === "history" && (
          <div className="py-2">
            {loadingInvites ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : invites.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No invitations sent yet.
              </p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell className="text-sm">{invite.email}</TableCell>
                        <TableCell className="text-sm">
                          {invite.name || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{getStatusBadge(invite.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(invite.created_at), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
