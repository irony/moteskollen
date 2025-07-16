import { useToast } from '@/hooks/use-toast';

interface ApiError {
  message: string;
  type: 'quota_exceeded' | 'invalid_api_key' | 'server_error' | 'unknown';
  code?: string;
}

export const useBergetApiError = () => {
  const { toast } = useToast();

  const handleApiError = (error: any) => {
    let title = "Fel";
    let description = error.message || "Ett okänt fel uppstod";
    let variant: "destructive" | "default" = "destructive";
    let action = null;

    // Kontrollera om det är ett strukturerat API-fel
    if (error.type) {
      switch (error.type) {
        case 'quota_exceeded':
          title = "API-kvot slut";
          description = "Du har nått din API-kvot. Fyll på ditt konto för att fortsätta.";
          action = {
            altText: "Fyll på konto",
            onClick: () => window.open('https://berget.ai', '_blank')
          };
          break;
          
        case 'invalid_api_key':
          title = "Ogiltig API-nyckel";
          description = "Din API-nyckel är ogiltig eller har gått ut. Logga in igen.";
          break;
          
        case 'server_error':
          title = "Serverfel";
          description = "Ett serverfel uppstod. Försök igen om ett ögonblick.";
          variant = "default";
          break;
          
        default:
          title = "API-fel";
          break;
      }
    }

    toast({
      title,
      description,
      variant,
      ...(action && {
        action: action.altText
      })
    });

    // Om det är quota-fel, öppna berget.ai automatiskt efter en kort delay
    if (error.type === 'quota_exceeded' && action) {
      setTimeout(() => {
        const shouldOpen = confirm("Vill du öppna Berget.ai för att fylla på ditt konto?");
        if (shouldOpen) {
          action.onClick();
        }
      }, 2000);
    }

    // Returnera om det är ett quota-fel för särskild hantering
    return error.type === 'quota_exceeded';
  };

  return { handleApiError };
};