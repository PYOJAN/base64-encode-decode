import { X509Certificate } from "@peculiar/x509"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CertDetailsContent } from "@/components/cert-display"
import { extractCN } from "@/utils/cert-helpers"

interface CertDetailDialogProps {
  cert: X509Certificate | null
  sha256: string
  sha1: string
  onClose: () => void
}

export function CertDetailDialog({
  cert,
  sha256,
  sha1,
  onClose,
}: CertDetailDialogProps) {
  const cn = cert ? extractCN(cert.subject) || cert.subject : ""

  return (
    <Dialog open={!!cert} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-sm font-semibold truncate">
            {cn || "Certificate Details"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-80px)] px-6 pb-6">
          {cert && (
            <CertDetailsContent cert={cert} sha256={sha256} sha1={sha1} />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
