# Токен `supabase login` из диспетчера учётных данных Windows (go-keyring: цель «Supabase CLI:<профиль>»).
# Печатает только сам токен в stdout — его читает scripts/prod-up.mjs и никуда не выводит.
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class VhCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags; public int Type; public string TargetName; public string Comment;
    public long LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob;
    public int Persist; public int AttributeCount; public IntPtr Attributes;
    public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredEnumerate(string filter, int flags, out int count, out IntPtr creds);
  [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr buffer);
  public static string Find(string filter) {
    int count; IntPtr list;
    if (!CredEnumerate(filter, 0, out count, out list)) return "";
    try {
      for (int i = 0; i < count; i++) {
        IntPtr item = Marshal.ReadIntPtr(list, i * IntPtr.Size);
        CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(item, typeof(CREDENTIAL));
        if (c.CredentialBlobSize == 0) continue;
        byte[] blob = new byte[c.CredentialBlobSize];
        Marshal.Copy(c.CredentialBlob, blob, 0, c.CredentialBlobSize);
        string text = System.Text.Encoding.UTF8.GetString(blob);
        if (text.StartsWith("sbp_") || text.StartsWith("go-keyring-base64:")) return text;
        string wide = System.Text.Encoding.Unicode.GetString(blob);
        if (wide.StartsWith("sbp_")) return wide;
      }
    } finally { CredFree(list); }
    return "";
  }
}
"@
[Console]::Out.Write([VhCred]::Find("Supabase CLI*"))
