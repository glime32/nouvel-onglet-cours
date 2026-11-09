/* Hôte natif « com.glime.fac » : donne à l'extension l'identifiant et le mot de
 * passe CAS rangés dans ~/.config/fac/identifiants (ou $FAC_IDENTIFIANTS), un
 * fichier lisible par toi seul :
 *
 *     identifiant=prenom.nom
 *     mot_de_passe=...
 *
 * Refuse de répondre si le fichier est lisible par d'autres (droits 600 exigés).
 *
 * cc -O2 -Wall -o fac-identifiants identifiants.c
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

static int lire(void *buf, size_t n) {
  char *p = buf;
  while (n) {
    ssize_t k = read(0, p, n);
    if (k <= 0) return -1;
    p += k;
    n -= (size_t)k;
  }
  return 0;
}

static void repondre(const char *msg) {
  uint32_t len = (uint32_t)strlen(msg);
  fwrite(&len, 4, 1, stdout);
  fwrite(msg, 1, len, stdout);
  fflush(stdout);
}

static void json(char *out, size_t n, const char *s) {
  size_t i = 0;
  for (; *s && i + 7 < n; s++) {
    unsigned char c = (unsigned char)*s;
    if (c == '"' || c == '\\') {
      out[i++] = '\\';
      out[i++] = (char)c;
    } else if (c < 0x20) {
      i += (size_t)snprintf(out + i, n - i, "\\u%04x", c);
    } else {
      out[i++] = (char)c;
    }
  }
  out[i] = 0;
}

static void valeur(char *ligne, const char *cle, char *dest, size_t n) {
  size_t k = strlen(cle);
  if (strncmp(ligne, cle, k) || ligne[k] != '=') return;
  char *v = ligne + k + 1;
  v[strcspn(v, "\r\n")] = 0;
  snprintf(dest, n, "%s", v);
}

static void donner(void) {
  char chemin[512];
  const char *env = getenv("FAC_IDENTIFIANTS");
  if (env && *env)
    snprintf(chemin, sizeof chemin, "%s", env);
  else
    snprintf(chemin, sizeof chemin, "%s/.config/fac/identifiants", getenv("HOME") ? getenv("HOME") : "");

  struct stat st;
  if (stat(chemin, &st) != 0) return repondre("{\"ok\":false,\"erreur\":\"absent\"}");
  if (st.st_mode & 077) return repondre("{\"ok\":false,\"erreur\":\"droits\"}");

  FILE *f = fopen(chemin, "r");
  if (!f) return repondre("{\"ok\":false,\"erreur\":\"illisible\"}");
  char ligne[512], u[256] = "", p[256] = "";
  while (fgets(ligne, sizeof ligne, f)) {
    valeur(ligne, "identifiant", u, sizeof u);
    valeur(ligne, "mot_de_passe", p, sizeof p);
  }
  fclose(f);
  if (!*u || !*p) return repondre("{\"ok\":false,\"erreur\":\"vide\"}");

  char ju[1600], jp[1600], msg[3300];
  json(ju, sizeof ju, u);
  json(jp, sizeof jp, p);
  snprintf(msg, sizeof msg, "{\"ok\":true,\"u\":\"%s\",\"p\":\"%s\"}", ju, jp);
  repondre(msg);
  memset(p, 0, sizeof p);
  memset(jp, 0, sizeof jp);
  memset(msg, 0, sizeof msg);
}

int main(void) {
  char msg[256];
  uint32_t len;
  while (lire(&len, 4) == 0) {
    if (len >= sizeof msg || lire(msg, len)) return 1;
    donner();
  }
  return 0;
}
