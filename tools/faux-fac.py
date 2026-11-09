"""Faux Moodle / CAS / Prose pour tester l'extension sans toucher aux vrais sites.

Lancement (test seulement, quelques minutes) :
  python3 -I tools/faux-fac.py CERT.pem CLE.pem PORT
puis un Helium jetable avec
  --host-resolver-rules="MAP moodle.umontpellier.fr 127.0.0.1:PORT, MAP cas.umontpellier.fr 127.0.0.1:PORT, MAP app.umontpellier.fr 127.0.0.1:PORT"
  --ignore-certificate-errors

Il imite ce qui compte : CAS en deux étages (/cas → /pre-otp et son formulaire
fm1 avec « execution »), le retour du ticket et la redirection « propre » de
phpCAS côté Moodle, core_session_touch, et Prose. Identifiant de test :
etu.test / se"cret. /journal donne les requêtes reçues (jamais de mot de passe).
"""
import http.server
import json
import ssl
import sys
import urllib.parse

journal = []
SVC_MOODLE = "https://moodle.umontpellier.fr/login/index.php?authCAS=CAS"


class Faux(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def cookies(self):
        c = {}
        for part in (self.headers.get("Cookie") or "").split(";"):
            if "=" in part:
                k, v = part.strip().split("=", 1)
                c[k] = v
        return c

    def send(self, code, body=b"", ctype="text/html; charset=utf-8", extra=()):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        for k, v in extra:
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def formulaire(self, service, erreur=False):
        panneau = b'<div id="loginErrorsPanel" class="banner banner-danger">Mauvais identifiants</div>' if erreur else b""
        execution = urllib.parse.quote(service, safe="").encode()
        return (b"<title>CAS</title>" + panneau +
                b'<form method="post" id="fm1" action="login"><input id="username" name="username">'
                b'<input id="password" name="password" type="password">'
                b'<input type="hidden" name="execution" value="' + execution + b'"/>'
                b'<input type="hidden" name="_eventId" value="submit"/><input type="hidden" name="geolocation"/>'
                b'<input type="hidden" name="deviceFingerprint"/><button id="submitBtn" type="submit">Login</button></form>')

    def do_GET(self):
        hote = self.headers.get("Host", "").split(":")[0]
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        p = u.path
        c = self.cookies()
        if p == "/journal":
            return self.send(200, "\n".join(journal).encode(), "text/plain")
        journal.append(f"GET {hote}{p}")
        if hote.startswith("cas."):
            if p == "/cas/login":
                svc = q.get("service", [""])[0]
                if c.get("connect.sid") == "ok":
                    return self.send(302, extra=[("Location", svc + ("&" if "?" in svc else "?") + "ticket=ST-1")])
                return self.send(302, extra=[("Location", "/pre-otp/login?service=" + urllib.parse.quote(svc, safe=""))])
            if p == "/pre-otp/login":
                return self.send(200, self.formulaire(q.get("service", [""])[0]))
            return self.send(404)
        if hote.startswith("app."):
            if p == "/prose-etudiant/protected/planning":
                if c.get("JSESSIONID") == "prose-ok":
                    return self.send(200, b"<title>planning</title>")
                if "ticket" in q:
                    return self.send(302, extra=[("Location", p), ("Set-Cookie", "JSESSIONID=prose-ok; Path=/prose-etudiant; Secure")])
                svc = "https://app.umontpellier.fr/prose-etudiant/protected/planning"
                return self.send(302, extra=[("Location", "https://cas.umontpellier.fr/cas/login?service=" + urllib.parse.quote(svc, safe=""))])
            return self.send(404)
        if p == "/login/index.php":
            if "ticket" in q:
                return self.send(302, extra=[("Location", "/login/index.php?authCAS=CAS"), ("Set-Cookie", "phpcas=ok; Path=/; Secure")])
            if "authCAS" in q:
                if c.get("phpcas") == "ok":
                    return self.send(303, extra=[("Location", "/my/"), ("Set-Cookie", "MoodleSession=valide; Path=/; Secure")])
                return self.send(303, extra=[("Location", "https://cas.umontpellier.fr/cas/login?service=" + urllib.parse.quote(SVC_MOODLE, safe="") + "&gateway=true")])
            return self.send(200, b'<body class="notloggedin"><a class="login-identityprovider-btn" href="/login/index.php?authCAS=CAS">CAS</a></body>')
        if p == "/my/":
            if c.get("MoodleSession") == "valide":
                return self.send(200, b'<title>Tableau</title><script>M.cfg = {"sesskey":"bonne"};</script>')
            return self.send(303, extra=[("Location", "/login/index.php")])
        self.send(404)

    def do_POST(self):
        hote = self.headers.get("Host", "").split(":")[0]
        u = urllib.parse.urlparse(self.path)
        corps = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
        if hote.startswith("cas.") and u.path == "/pre-otp/login":
            f = urllib.parse.parse_qs(corps, keep_blank_values=True)
            bon = f.get("username") == ["etu.test"] and f.get("password") == ['se"cret']
            svc = urllib.parse.unquote(f.get("execution", [""])[0])
            journal.append(f"POST cas/pre-otp/login {'accepté' if bon else 'refusé'}")
            if not bon:
                return self.send(200, self.formulaire(svc, erreur=True))
            return self.send(302, extra=[("Location", "/cas/login?service=" + urllib.parse.quote(svc, safe="")),
                                         ("Set-Cookie", "connect.sid=ok; Path=/cas; Secure")])
        q = urllib.parse.parse_qs(u.query)
        ok = q.get("sesskey") == ["bonne"] and self.cookies().get("MoodleSession") == "valide"
        journal.append(f"POST moodle touch -> {'ok' if ok else 'refus'}")
        rep = [{"error": False, "data": True}] if ok else [{"error": True}]
        self.send(200, json.dumps(rep).encode(), "application/json")


if __name__ == "__main__":
    cert, cle, port = sys.argv[1], sys.argv[2], int(sys.argv[3])
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), Faux)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert, cle)
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    srv.serve_forever()
