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
  const [tokenUsage, setTokenUsage] = useState<any>(null);
  const [subscriptionUsage, setSubscriptionUsage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUsage = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Hämta både token usage och subscription usage
      const [tokenData, subscriptionData] = await Promise.all([
        bergetApi.getTokenUsage(),
        bergetApi.getSubscriptionUsage().catch(() => null) // Subscription kan vara optional
      ]);
      
      setTokenUsage(tokenData);
      setSubscriptionUsage(subscriptionData);
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

  const formatCurrency = (amount: number, currency = 'SEK') => {
    // Konvertera cents till currency units om det behövs
    const actualAmount = currency === 'SEK' ? amount / 100 : amount;
    
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'SEK',
      minimumFractionDigits: 2
    }).format(actualAmount);
  };

  const getRemainingBalance = () => {
    if (!subscriptionUsage?.usage) return null;
    
    const currentUsage = subscriptionUsage.usage.currentUsageAmountCents || 0;
    // Om vi har en plan med begränsningar, skulle vi beräkna återstående här
    // För nu visar vi bara aktuell användning
    return currentUsage;
  };

  const getUsageStatus = (currentUsage: number) => {
    // Detta skulle kunna baseras på plan-gränser i framtiden
    if (currentUsage > 10000) return { color: 'destructive', text: 'Hög användning' };
    if (currentUsage > 5000) return { color: 'warning', text: 'Måttlig användning' };
    return { color: 'success', text: 'Låg användning' };
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[80vh] overflow-y-auto">
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
          ) : (tokenUsage || subscriptionUsage) ? (
            <>
              {/* Prenumerationsöversikt */}
              {subscriptionUsage && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Prenumerationsstatus</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Status</div>
                        <div className="font-medium">{subscriptionUsage.status}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Plan</div>
                        <div className="font-medium">{subscriptionUsage.planCode}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Period</div>
                        <div className="font-medium text-xs">
                          {new Date(subscriptionUsage.currentBillingPeriodStartDate).toLocaleDateString('sv-SE')} - 
                          {new Date(subscriptionUsage.currentBillingPeriodEndDate).toLocaleDateString('sv-SE')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Token användning översikt */}
              {tokenUsage && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">
                            {formatCurrency(tokenUsage.total.cost.amount, tokenUsage.total.cost.currency)}
                          </div>
                          <div className="text-sm text-muted-foreground">Total kostnad</div>
                          <div className="flex items-center justify-center mt-2 text-xs text-muted-foreground">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            {tokenUsage.period.start} - {tokenUsage.period.end}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {tokenUsage.total.total_tokens.toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">Totala tokens</div>
                          <div className="flex items-center justify-center mt-2 text-xs text-muted-foreground">
                            <Zap className="w-3 h-3 mr-1" />
                            {tokenUsage.total.input_tokens.toLocaleString()} in / {tokenUsage.total.output_tokens.toLocaleString()} ut
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {tokenUsage.usage.length}
                          </div>
                          <div className="text-sm text-muted-foreground">Aktiva dagar</div>
                          <div className="flex items-center justify-center mt-2 text-xs text-muted-foreground">
                            <DollarSign className="w-3 h-3 mr-1" />
                            Med API-användning
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Användning per dag och modell */}
                  {tokenUsage.usage && tokenUsage.usage.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Detaljerad användning</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {tokenUsage.usage.slice(0, 10).map((day: any, index: number) => (
                            <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                              <div>
                                <div className="font-medium">{day.date}</div>
                                <div className="text-sm text-muted-foreground">
                                  {day.model}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">
                                  {formatCurrency(day.cost.amount, day.cost.currency)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {day.total_tokens.toLocaleString()} tokens
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* Aktuell period användning (från subscription) */}
              {subscriptionUsage?.usage && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Aktuell period</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {formatCurrency(subscriptionUsage.usage.currentUsageAmountCents)}
                        </div>
                        <div className="text-sm text-muted-foreground">Aktuell användning</div>
                        <Badge 
                          variant={getUsageStatus(subscriptionUsage.usage.currentUsageAmountCents).color === 'destructive' ? 'destructive' : 'default'}
                          className="mt-2"
                        >
                          {getUsageStatus(subscriptionUsage.usage.currentUsageAmountCents).text}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatCurrency(subscriptionUsage.usage.invoicedUsageAmountCents)}
                        </div>
                        <div className="text-sm text-muted-foreground">Fakturerad användning</div>
                      </div>
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
                      <p>• Transkribering: Kostnad per minut ljudfil och antal tokens</p>
                      <p>• Protokollgenerering: Kostnad baserat på input/output tokens</p>
                      <p>• AI-chat: Kostnad per meddelande och tokens</p>
                      <p>• Kostnader visas för aktuell faktureringsperiod</p>
                    </div>
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open('https://berget.ai', '_blank')}
                        className="flex items-center space-x-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Hantera konto på Berget.ai</span>
                      </Button>
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