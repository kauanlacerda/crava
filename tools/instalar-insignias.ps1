# Instala uma folha de insignias: fatia por colunas vazias, auto-separa
# pares grudados ate bater a contagem, e nomeia pelos ids na ordem.
param(
  [Parameter(Mandatory=$true)][string]$Src,
  [Parameter(Mandatory=$true)][string[]]$Ids
)
Add-Type -AssemblyName System.Drawing

$code = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;
public class InsigniaSplit2 {
  static List<int[]> Spans(Bitmap sheet, int gap){
    int W=sheet.Width, H=sheet.Height;
    bool[] colSolid=new bool[W];
    for(int x=0;x<W;x++) for(int y=0;y<H;y++) if(sheet.GetPixel(x,y).A>10){ colSolid[x]=true; break; }
    List<int[]> spans=new List<int[]>(); int sx=-1;
    for(int x=0;x<W;x++){
      if(colSolid[x] && sx<0) sx=x;
      if((!colSolid[x]||x==W-1) && sx>=0){
        int ex = colSolid[x]&&x==W-1 ? x : x-1;
        if(spans.Count>0 && sx-spans[spans.Count-1][1]<=gap) spans[spans.Count-1][1]=ex;
        else spans.Add(new int[]{sx,ex});
        sx=-1;
      }
    }
    spans.RemoveAll(s => s[1]-s[0] < 25);
    return spans;
  }
  static int Vale(Bitmap sheet, int x0, int x1){
    int H=sheet.Height;
    int a=x0+(int)((x1-x0)*0.35), b=x0+(int)((x1-x0)*0.65);
    int best=(x0+x1)/2, bestCount=int.MaxValue;
    for(int x=a;x<b;x++){
      int cnt=0;
      for(int y=0;y<H;y++) if(sheet.GetPixel(x,y).A>10) cnt++;
      if(cnt<bestCount){bestCount=cnt;best=x;}
    }
    return best;
  }
  // fatia e, se faltar parte, divide as mais largas no vale ate bater want
  public static List<int[]> SpansAjustadas(Bitmap sheet, int gap, int want){
    List<int[]> spans = Spans(sheet, gap);
    int guarda = 0;
    while (spans.Count < want && guarda++ < 10) {
      int idx = 0;
      for (int i = 1; i < spans.Count; i++)
        if (spans[i][1]-spans[i][0] > spans[idx][1]-spans[idx][0]) idx = i;
      int[] maior = spans[idx];
      int corte = Vale(sheet, maior[0], maior[1]);
      spans[idx] = new int[]{ maior[0], corte - 1 };
      spans.Insert(idx + 1, new int[]{ corte, maior[1] });
    }
    return spans;
  }
  public static void SaveSpan(Bitmap sheet, int x0, int x1, string outPath){
    int W=sheet.Width, H=sheet.Height;
    int minx=int.MaxValue,miny=int.MaxValue,maxx=-1,maxy=-1;
    for(int y=0;y<H;y++) for(int x=x0;x<=x1;x++)
      if(sheet.GetPixel(x,y).A>10){ if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; }
    if(maxx<0) return;
    int pad=4;
    int cx0=Math.Max(0,minx-pad), cy0=Math.Max(0,miny-pad);
    int w=Math.Min(W-1,maxx+pad)-cx0+1, h=Math.Min(H-1,maxy+pad)-cy0+1;
    Bitmap ob=new Bitmap(w,h,PixelFormat.Format32bppArgb);
    using(Graphics g=Graphics.FromImage(ob)) g.DrawImage(sheet,new Rectangle(0,0,w,h),new Rectangle(cx0,cy0,w,h),GraphicsUnit.Pixel);
    ob.Save(outPath, ImageFormat.Png);
    ob.Dispose();
  }
}
'@
try { Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing -ErrorAction Stop } catch {}

$destDir = 'C:\dev\cravado\assets\insignias'
$sheet = New-Object System.Drawing.Bitmap($Src)
$spans = [InsigniaSplit2]::SpansAjustadas($sheet, 6, $Ids.Count)
Write-Output "partes: $($spans.Count) (esperado: $($Ids.Count))"

if ($spans.Count -ne $Ids.Count) {
  Write-Output "ERRO: contagem nao bate - nada instalado."
  $sheet.Dispose(); exit 1
}

for ($i = 0; $i -lt $Ids.Count; $i++) {
  [InsigniaSplit2]::SaveSpan($sheet, $spans[$i][0], $spans[$i][1], (Join-Path $destDir ($Ids[$i] + '.png')))
}
$sheet.Dispose()
Write-Output ('INSTALADO: ' + ($Ids -join ', '))
