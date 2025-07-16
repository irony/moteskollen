import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp,
  DollarSign,
  Zap,
  ExternalLink
} from 'lucide-react';
import { bergetApi } from '@/services/bergetApi';
import { useToast } from '@/hooks/use-toast';

interface UsageDisplayProps {
  isVisible: boolean;
  onClose: () => void;
}

export const UsageDisplay: React.FC<UsageDisplayProps> = ({ isVisible, onClose }) => {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUsage = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const usageData = await bergetApi.getUsage();
      setUsage(usageData);
    } catch (err: any) {
      if (err.type === 'quota_exceeded') {
        setError('API-kvoten är slut. Fyll på ditt konto för att fortsätta.');
      } else if (err.type === 'invalid_api_key') {
        setError('API-nyckeln är ogiltig. Logga in igen.');
      } else {
        setError(err.message || 'Kunde inte hämta användningsdata.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      fetchUsage();
    }
  }, [isVisible]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getBalanceStatus = (balance: number) => {
    if (balance <= 0) return { color: 'destructive', text: 'Slut på krediter' };
    if (balance < 50) return { color: 'warning', text: 'Lågt saldo' };
    return { color: 'success', text: 'Gott saldo' };
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5" />
            <span>API Användning & Kostnad</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsage}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Uppdatera
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Stäng
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
              {error.includes('kvoten är slut') && (
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://berget.ai', '_blank')}
                    className="flex items-center space-x-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Fyll på konto</span>
                  </Button>
                </div>
              )}
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>Hämtar användningsdata...</span>
            </div>
          ) : usage ? (
            <>
              {/* Saldo översikt */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(usage.balance)}
                      </div>
                      <div className="text-sm text-muted-foreground">Aktuellt saldo</div>
                      <Badge 
                        variant={getBalanceStatus(usage.balance).color === 'destructive' ? 'destructive' : 'default'}
                        className="mt-2"
                      >
                        {getBalanceStatus(usage.balance).text}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {formatCurrency(usage.usage.total_cost)}
                      </div>
                      <div className="text-sm text-muted-foreground">Total kostnad</div>
                      <div className="flex items-center justify-center mt-2 text-xs text-muted-foreground">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Denna månad
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {usage.usage.requests.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">API-anrop</div>
                      <div className="flex items-center justify-center mt-2 text-xs text-muted-foreground">
                        <Zap className="w-3 h-3 mr-1" />
                        Totalt gjorda
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Varning vid lågt saldo */}
              {usage.balance < 50 && (
                <Alert variant={usage.balance <= 0 ? 'destructive' : 'default'}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {usage.balance <= 0 
                      ? 'Ditt saldo är slut. Du kan inte göra fler API-anrop förrän du fyller på ditt konto.'
                      : `Lågt saldo: ${formatCurrency(usage.balance)}. Överväg att fylla på ditt konto snart.`
                    }
                  </AlertDescription>
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open('https://berget.ai', '_blank')}
                      className="flex items-center space-x-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Fyll på konto</span>
                    </Button>
                  </div>
                </Alert>
              )}

              {/* Senaste användning */}
              {usage.recent_usage && usage.recent_usage.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Senaste användning</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {usage.recent_usage.slice(0, 5).map((day: any, index: number) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                          <div>
                            <div className="font-medium">{day.date}</div>
                            <div className="text-sm text-muted-foreground">
                              {day.requests} anrop
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(day.cost)}</div>
                            <div className="text-sm text-muted-foreground">
                              {day.tokens.toLocaleString()} tokens
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Information */}
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <h4 className="font-medium">Kostnadsinformation</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>• Transkribering: Kostnad per minut ljudfil</p>
                      <p>• Protokollgenerering: Kostnad per genererat protokoll</p>
                      <p>• AI-chat: Kostnad per meddelande</p>
                      <p>• Priser uppdateras automatiskt och visas i realtid</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Klicka på "Uppdatera" för att hämta användningsdata
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};