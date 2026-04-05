$f = "src\pages\Marketplaces.jsx"
$c = [IO.File]::ReadAllText($f)
$old = "import { Store, Wifi, Download, Upload, ClipboardList, PauseCircle, PlayCircle, RefreshCw } from 'lucide-react';"
$new = "import { Store, Wifi, Download, Upload, ClipboardList, PauseCircle, PlayCircle, RefreshCw, ExternalLink } from 'lucide-react';"
$c = $c.Replace($old, $new)
[IO.File]::WriteAllText($f, $c)
Write-Host "Feito!"
