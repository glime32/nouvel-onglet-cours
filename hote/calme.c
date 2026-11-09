/* Hôte natif du mode révision : coupe ou rétablit les notifications KDE.
 *
 * Helium envoie {"cmd":"calme","jusqua":"2026,11,9,10,42,0"} au début d'un bloc
 * de travail et {"cmd":"bruit"} à la fin. On écrit la clé Until du groupe
 * DoNotDisturb de plasmanotifyrc, comme le fait le bouton « Ne pas déranger ».
 *
 * cc -O2 -Wall -o nouvel-onglet-calme calme.c
 */
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
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

static void repondre(int ok) {
  const char *msg = ok ? "{\"ok\":true}" : "{\"ok\":false}";
  uint32_t len = (uint32_t)strlen(msg);
  fwrite(&len, 4, 1, stdout);
  fwrite(msg, 1, len, stdout);
  fflush(stdout);
}

static int lancer(char *const argv[]) {
  pid_t pid = fork();
  if (pid < 0) return 0;
  if (pid == 0) {
    if (dup2(2, 1) < 0) _exit(127); /* stdout appartient au protocole */
    execvp(argv[0], argv);
    _exit(127);
  }
  int st;
  if (waitpid(pid, &st, 0) < 0) return 0;
  return WIFEXITED(st) && WEXITSTATUS(st) == 0;
}

/* "jusqua":"…" ne doit contenir que des chiffres et des virgules */
static int date_de(const char *msg, char *out, size_t n) {
  const char *p = strstr(msg, "\"jusqua\":\"");
  if (!p) return 0;
  p += 10;
  size_t i = 0;
  for (; p[i] && p[i] != '"'; i++) {
    if (i + 1 >= n) return 0;
    if (!((p[i] >= '0' && p[i] <= '9') || p[i] == ',')) return 0;
    out[i] = p[i];
  }
  out[i] = 0;
  return p[i] == '"' && i > 10;
}

int main(void) {
  char msg[512], date[40];
  uint32_t len;
  while (lire(&len, 4) == 0) {
    if (len >= sizeof msg) return 1;
    if (lire(msg, len)) return 1;
    msg[len] = 0;

    int ok = 0;
    if (strstr(msg, "\"cmd\":\"calme\"") && date_de(msg, date, sizeof date)) {
      char *argv[] = {"kwriteconfig6", "--file", "plasmanotifyrc", "--group", "DoNotDisturb",
                      "--key", "Until", date, "--notify", NULL};
      ok = lancer(argv);
    } else if (strstr(msg, "\"cmd\":\"bruit\"")) {
      char *argv[] = {"kwriteconfig6", "--file", "plasmanotifyrc", "--group", "DoNotDisturb",
                      "--key", "Until", "--delete", "--notify", NULL};
      ok = lancer(argv);
    }
    repondre(ok);
  }
  return 0;
}
