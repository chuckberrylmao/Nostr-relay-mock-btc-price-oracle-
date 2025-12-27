import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KeyRound, UserPlus, Wallet, Lock, Unlock, Trash2, Copy, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadAccount, createLocalAccount, createGuestAccount, decryptSecretKey, clearAccount, haveNip07, getNip07Pubkey, truncatePubkey } from "@/lib/nostr";
import type { LocalAccount } from "@shared/schema";

export type AccountMode = "local" | "nip07";

interface AccountPanelProps {
  mode: AccountMode;
  setMode: (mode: AccountMode) => void;
  secretKey: Uint8Array | null;
  setSecretKey: (key: Uint8Array | null) => void;
  pubkeyHex: string | null;
  setPubkeyHex: (key: string | null) => void;
}

export function AccountPanel({ mode, setMode, secretKey, setSecretKey, pubkeyHex, setPubkeyHex }: AccountPanelProps) {
  const { toast } = useToast();
  const [account, setAccount] = useState<LocalAccount | null>(() => loadAccount());
  const [passphrase, setPassphrase] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreateAccount = async () => {
    if (!passphrase || passphrase.length < 6) {
      toast({
        title: "Invalid passphrase",
        description: "Passphrase must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { account: newAccount, secretKey: sk } = await createLocalAccount(passphrase);
      setAccount(newAccount);
      setSecretKey(sk);
      setPubkeyHex(newAccount.pubkeyHex);
      setPassphrase("");
      toast({
        title: "Account created",
        description: "Your local Nostr account has been created and unlocked",
      });
    } catch (error) {
      toast({
        title: "Failed to create account",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!account || !passphrase) {
      toast({
        title: "Enter passphrase",
        description: "Please enter your passphrase to unlock",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const sk = await decryptSecretKey(account.enc, passphrase);
      setSecretKey(sk);
      setPubkeyHex(account.pubkeyHex);
      setPassphrase("");
      toast({
        title: "Account unlocked",
        description: "Your account is now ready to use",
      });
    } catch (error) {
      toast({
        title: "Unlock failed",
        description: "Invalid passphrase",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLock = () => {
    setSecretKey(null);
    setPubkeyHex(null);
    toast({
      title: "Account locked",
      description: "Your secret key has been cleared from memory",
    });
  };

  const handleDelete = () => {
    clearAccount();
    setAccount(null);
    setSecretKey(null);
    setPubkeyHex(null);
    toast({
      title: "Account deleted",
      description: "Your local account has been removed",
    });
  };

  const handleGuest = () => {
    const { pubkeyHex: pk, secretKey: sk } = createGuestAccount();
    setSecretKey(sk);
    setPubkeyHex(pk);
    toast({
      title: "Guest session started",
      description: "Temporary key created (not saved)",
    });
  };

  const handleUseNip07 = async () => {
    setMode("nip07");
    const pk = await getNip07Pubkey();
    if (pk) {
      setPubkeyHex(pk);
      toast({
        title: "Wallet connected",
        description: "Using NIP-07 browser extension",
      });
    } else if (!haveNip07()) {
      toast({
        title: "No wallet detected",
        description: "Install a Nostr wallet extension",
        variant: "destructive",
      });
    }
  };

  const handleUseLocal = () => {
    setMode("local");
    if (account && secretKey) {
      setPubkeyHex(account.pubkeyHex);
    } else {
      setPubkeyHex(null);
    }
  };

  const copyPubkey = async () => {
    if (pubkeyHex) {
      await navigator.clipboard.writeText(pubkeyHex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied", description: "Public key copied to clipboard" });
    }
  };

  const renderAccountState = () => {
    if (mode === "nip07") {
      return (
        <div className="space-y-4">
          <Badge variant="secondary" className="gap-2">
            <Wallet className="h-3 w-3" />
            NIP-07 Wallet Mode
          </Badge>
          <p className="text-sm text-muted-foreground">{haveNip07() ? "Wallet detected. Click 'Get BTC Price' to sign requests." : "No wallet detected. Install a browser extension or switch to local account."}</p>
        </div>
      );
    }

    if (!account) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassphrase">New account passphrase</Label>
            <Input id="newPassphrase" type="password" placeholder="Choose a passphrase (min 6 chars)" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} data-testid="input-new-passphrase" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCreateAccount} disabled={isLoading} data-testid="button-create-account">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Create Account
            </Button>
            <Button variant="secondary" onClick={handleGuest} data-testid="button-guest-session">
              <KeyRound className="h-4 w-4" />
              Guest Session
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Guest session generates a temporary key (not saved).</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-2 font-mono text-xs px-2 py-1">
            <KeyRound className="h-3 w-3" />
            {truncatePubkey(account.npub, 6)}
          </Badge>
          {secretKey && <Badge variant="secondary">Unlocked</Badge>}
        </div>

        {!secretKey && (
          <div className="space-y-2">
            <Label htmlFor="unlockPassphrase">Passphrase</Label>
            <Input id="unlockPassphrase" type="password" placeholder="Enter passphrase to unlock" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} data-testid="input-unlock-passphrase" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!secretKey ? (
            <Button onClick={handleUnlock} disabled={isLoading} data-testid="button-unlock">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              Unlock
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleLock} data-testid="button-lock">
              <Lock className="h-4 w-4" />
              Lock
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive" data-testid="button-delete-account">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Unlocked key stays in memory for this session only.</p>
      </div>
    );
  };

  return (
    <Card data-testid="card-account-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Account
        </CardTitle>
        <CardDescription>Create a local keypair or use a NIP-07 wallet extension.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderAccountState()}

        {pubkeyHex && (
          <div className="pt-2 border-t">
            <Label className="text-xs text-muted-foreground">Active Public Key</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-xs font-mono bg-muted/50 px-2 py-1.5 rounded truncate" data-testid="text-active-pubkey">
                {truncatePubkey(pubkeyHex, 12)}
              </code>
              <Button variant="ghost" size="icon" onClick={copyPubkey} className="shrink-0" data-testid="button-copy-pubkey">
                {copied ? <Check className="h-4 w-4 text-chart-2" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button variant={mode === "nip07" ? "secondary" : "outline"} size="sm" onClick={handleUseNip07} className="gap-2" data-testid="button-use-nip07">
            <Wallet className="h-3 w-3" />
            NIP-07 Wallet
          </Button>
          <Button variant={mode === "local" ? "secondary" : "outline"} size="sm" onClick={handleUseLocal} className="gap-2" data-testid="button-use-local">
            <KeyRound className="h-3 w-3" />
            Local Account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
