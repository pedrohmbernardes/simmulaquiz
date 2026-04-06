'use client';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, Video, Link as LinkIcon } from "lucide-react";

// Tipagem alinhada com o Schema
interface Material {
  id: number;
  titulo: string;
  tipo: 'PDF_UPLOAD' | 'LINK_EXTERNO' | 'GOOGLE_DRIVE' | 'VIDEO_YOUTUBE';
  url: string;
  descricao?: string | null;
}

interface StudentMaterialViewerProps {
  material: Material | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentMaterialViewer({ material, open, onOpenChange }: StudentMaterialViewerProps) {
  if (!material) return null;

  // Helper para extrair ID do YouTube (suporta youtu.be e youtube.com)
  const getYoutubeEmbedUrl = (url: string) => {
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      const id = (match && match[2].length === 11) ? match[2] : null;
      return id ? `https://www.youtube.com/embed/${id}` : url;
    } catch {
      return url;
    }
  };

  const renderContent = () => {
    switch (material.tipo) {
      case 'VIDEO_YOUTUBE':
        return (
          <div className="aspect-video w-full rounded-md overflow-hidden bg-black border">
            <iframe
              width="100%"
              height="100%"
              src={getYoutubeEmbedUrl(material.url)}
              title={material.titulo}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="border-0"
            />
          </div>
        );

      case 'PDF_UPLOAD':
        return (
          <div className="w-full h-[60vh] bg-muted rounded-md border overflow-hidden flex flex-col items-center justify-center relative group">
             {/* Fallback visual enquanto carrega ou se falhar */}
             <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground z-0">
                <FileText className="h-12 w-12 mb-2 opacity-20" />
                <p className="text-sm">Carregando visualização...</p>
             </div>
             
             {/* Object tag para PDF nativo */}
             <object
               data={material.url}
               type="application/pdf"
               className="w-full h-full z-10 relative"
             >
               <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                 <p className="mb-2">Este navegador não suporta visualização direta de PDF.</p>
                 <Button asChild variant="outline">
                   <a href={material.url} target="_blank" rel="noopener noreferrer">
                     Baixar PDF
                   </a>
                 </Button>
               </div>
             </object>
          </div>
        );

      case 'GOOGLE_DRIVE':
      case 'LINK_EXTERNO':
      default:
        // Links externos geralmente bloqueiam iframes por segurança (X-Frame-Options),
        // então mostramos um card bonito convidando a abrir em nova aba.
        return (
          <div className="flex flex-col items-center justify-center py-12 px-4 bg-muted/30 rounded-lg border border-dashed text-center">
            {material.tipo === 'GOOGLE_DRIVE' ? (
              <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <FileText className="h-8 w-8" />
              </div>
            ) : (
              <div className="h-16 w-16 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center mb-4">
                <LinkIcon className="h-8 w-8" />
              </div>
            )}
            
            <h4 className="text-lg font-medium mb-2">Conteúdo Externo</h4>
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
              Este material está hospedado em um link externo ({material.tipo === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Site Externo'}).
            </p>
            
            <Button asChild size="lg" className="gap-2">
              <a href={material.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Acessar Conteúdo
              </a>
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6 leading-normal">
            {material.tipo === 'VIDEO_YOUTUBE' && <Video className="h-5 w-5 text-red-500" />}
            {material.tipo === 'PDF_UPLOAD' && <FileText className="h-5 w-5 text-orange-500" />}
            {(material.tipo === 'LINK_EXTERNO' || material.tipo === 'GOOGLE_DRIVE') && <LinkIcon className="h-5 w-5 text-blue-500" />}
            <span className="truncate">{material.titulo}</span>
          </DialogTitle>
          {material.descricao && (
             <DialogDescription className="text-left pt-1">
               {material.descricao}
             </DialogDescription>
          )}
        </DialogHeader>

        <div className="mt-2">
          {renderContent()}
        </div>

        <DialogFooter className="sm:justify-between gap-2 border-t pt-4 mt-4">
           <div className="text-xs text-muted-foreground self-center hidden sm:block">
             {material.tipo === 'PDF_UPLOAD' ? 'PDF' : material.tipo === 'VIDEO_YOUTUBE' ? 'Vídeo' : 'Link Externo'}
           </div>
           
           <div className="flex gap-2 w-full sm:w-auto">
             <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
               Fechar
             </Button>
             {/* Sempre oferecer opção de abrir fora, caso o modal falhe */}
             <Button asChild variant="secondary" className="flex-1 sm:flex-none gap-2">
               <a href={material.url} target="_blank" rel="noopener noreferrer">
                 <ExternalLink className="h-3 w-3" />
                 Abrir na Web
               </a>
             </Button>
           </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}