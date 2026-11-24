Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot '..\client\public\instrument-kit-original.jpg'
$targetPath = Join-Path $PSScriptRoot '..\client\src\assets\instrument-kit-blue.png'
$bitmap = [System.Drawing.Bitmap]::new((Resolve-Path $sourcePath).Path)

for ($y = 650; $y -lt $bitmap.Height; $y++) {
  for ($x = 0; $x -lt $bitmap.Width; $x++) {
    $pixel = $bitmap.GetPixel($x, $y)
    $r = $pixel.R / 255.0
    $g = $pixel.G / 255.0
    $b = $pixel.B / 255.0
    $max = [Math]::Max($r, [Math]::Max($g, $b))
    $min = [Math]::Min($r, [Math]::Min($g, $b))
    $delta = $max - $min
    if ($max -eq 0 -or $delta -eq 0) { continue }

    $saturation = $delta / $max
    $hue = if ($max -eq $r) { 60 * ((($g - $b) / $delta) % 6) } elseif ($max -eq $g) { 60 * ((($b - $r) / $delta) + 2) } else { 60 * ((($r - $g) / $delta) + 4) }
    if ($hue -lt 0) { $hue += 360 }

    if ($saturation -gt 0.45 -and ($hue -lt 28 -or $hue -gt 335)) {
      $newHue = 211.0
      $newSaturation = [Math]::Min(0.88, [Math]::Max(0.55, $saturation * 0.9))
      $c = $max * $newSaturation
      $h = $newHue / 60.0
      $xValue = $c * (1 - [Math]::Abs(($h % 2) - 1))
      $m = $max - $c
      if ($h -lt 1) { $nr = $c; $ng = $xValue; $nb = 0 }
      elseif ($h -lt 2) { $nr = $xValue; $ng = $c; $nb = 0 }
      elseif ($h -lt 3) { $nr = 0; $ng = $c; $nb = $xValue }
      elseif ($h -lt 4) { $nr = 0; $ng = $xValue; $nb = $c }
      elseif ($h -lt 5) { $nr = $xValue; $ng = 0; $nb = $c }
      else { $nr = $c; $ng = 0; $nb = $xValue }
      $bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, [int](($nr + $m) * 255), [int](($ng + $m) * 255), [int](($nb + $m) * 255)))
    }
  }
}

$bitmap.Save((Resolve-Path (Join-Path $PSScriptRoot '..\client\src\assets')).Path + '\instrument-kit-blue.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
