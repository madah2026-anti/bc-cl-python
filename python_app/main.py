# ============================================================
# main.py – BC ERP FastAPI Python Server
# ============================================================
import os
import re
import urllib.parse
from pathlib import Path
from typing import Optional, Dict, Any

import bcrypt
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response, Form, HTTPException, Query, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

import database as db

load_dotenv()

# Categories that store item_qty as POSITIVE (incoming / add-to-stock flows).
# All other sales categories store item_qty as NEGATIVE.
POSITIVE_QTY_CATS = {14}

BASE_DIR = Path(__file__).resolve().parent.parent
VIEWS_DIR = BASE_DIR / "views"
PUBLIC_DIR = BASE_DIR / "public"

app = FastAPI(
    title="BC ERP - Python Backend",
    description="Full-stack FastAPI web application for BC ERP",
    version="1.0.0"
)

# ── Session Middleware ───────────────────────────────────────
SESSION_SECRET = os.getenv("SESSION_SECRET", "bcerp_super_secret_session_key_2026")
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    session_cookie="bcerp_session",
    max_age=3600 * 2  # 2 hours
)

# ── Static Files ─────────────────────────────────────────────
app.mount("/css", StaticFiles(directory=PUBLIC_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=PUBLIC_DIR / "js"), name="js")
if (PUBLIC_DIR / "images").exists():
    app.mount("/images", StaticFiles(directory=PUBLIC_DIR / "images"), name="images")

# Mount public directory root as well for any direct static assets
app.mount("/public", StaticFiles(directory=PUBLIC_DIR), name="public")


# ── HTML View Include Engine ────────────────────────────────
def render_html_view(view_path: Path) -> str:
    if not view_path.exists():
        return f"<!-- View {view_path.name} not found -->"
    
    content = view_path.read_text(encoding="utf-8")
    base_dir = view_path.parent

    def replace_include(match):
        partial_rel_path = match.group(1).strip()
        partial_abs_path = (base_dir / partial_rel_path).resolve()
        if partial_abs_path.exists():
            return render_html_view(partial_abs_path)
        print(f"⚠ Partial not found: {partial_abs_path}")
        return f"<!-- Partial {partial_rel_path} not found -->"

    include_regex = re.compile(r"<!--\s*include:\s*([^\s\->]+)\s*-->")
    return include_regex.sub(replace_include, content)



# ── Auth Guard Helper ────────────────────────────────────────
def get_session_user(request: Request) -> Optional[Dict[str, Any]]:
    return request.session.get("user")

def require_auth(request: Request):
    user = get_session_user(request)
    if not user:
        error_msg = urllib.parse.quote("يرجى تسجيل الدخول أولاً")
        raise HTTPException(
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            headers={"Location": f"/login?error={error_msg}"}
        )
    return user


# ══════════════════════════════════════════════════════════════
#  VIEW ROUTES
# ══════════════════════════════════════════════════════════════

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/", response_class=RedirectResponse)
def index(request: Request):
    if get_session_user(request):
        return RedirectResponse(url="/dashboard", status_code=302)
    return RedirectResponse(url="/login", status_code=302)


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    if get_session_user(request):
        return RedirectResponse(url="/dashboard", status_code=302)
    html_content = render_html_view(VIEWS_DIR / "login.html")
    return HTMLResponse(content=html_content)


@app.get("/register", response_class=HTMLResponse)
def register_page(request: Request):
    if get_session_user(request):
        return RedirectResponse(url="/dashboard", status_code=302)
    html_content = render_html_view(VIEWS_DIR / "register.html")
    return HTMLResponse(content=html_content)


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard_page(request: Request):
    user = get_session_user(request)
    if not user:
        error_msg = urllib.parse.quote("يرجى تسجيل الدخول أولاً")
        return RedirectResponse(url=f"/login?error={error_msg}", status_code=302)
    
    try:
        html_content = render_html_view(VIEWS_DIR / "dashboard.html")
        return HTMLResponse(content=html_content)
    except Exception as err:
        print(f"Error rendering dashboard: {err}")
        return HTMLResponse(content="Error loading dashboard", status_code=500)


# ══════════════════════════════════════════════════════════════
#  AUTH APIs
# ══════════════════════════════════════════════════════════════

@app.get("/api/me")
def get_me(request: Request):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Unauthenticated"})
    return {
        "user": {
            "id": user.get("id"),
            "username": user.get("username"),
            "created_at": user.get("created_at")
        }
    }


@app.post("/login")
def login_post(
    request: Request,
    username: str = Form(""),
    password: str = Form("")
):
    if not username.strip() or not password.strip():
        err = urllib.parse.quote("اسم المستخدم وكلمة المرور مطلوبان")
        return RedirectResponse(url=f"/login?error={err}", status_code=303)
    
    clean_uname = username.strip()
    user = db.query_one("SELECT * FROM users WHERE user_name = %s", (clean_uname,))
    
    if not user:
        err = urllib.parse.quote("اسم المستخدم أو كلمة المرور غير صحيحة")
        return RedirectResponse(url=f"/login?error={err}", status_code=303)
    
    stored_pw = user.get("user_password") or ""
    pw_match = False
    
    if password == stored_pw:
        pw_match = True
    else:
        try:
            stored_bytes = stored_pw.encode("utf-8") if isinstance(stored_pw, str) else stored_pw
            if bcrypt.checkpw(password.encode("utf-8"), stored_bytes):
                pw_match = True
        except Exception:
            pw_match = False
            
    if not pw_match:
        err = urllib.parse.quote("اسم المستخدم أو كلمة المرور غير صحيحة")
        return RedirectResponse(url=f"/login?error={err}", status_code=303)
    
    user_id = user.get("id") or user.get("show_name") or user.get("user_name")
    username_val = user.get("user_name") or user.get("username")
    
    request.session["user"] = {
        "id": user_id,
        "show_name": user.get("show_name") or username_val,
        "username": username_val,
        "created_at": str(user.get("created_at")) if user.get("created_at") else None
    }

    print(f"→ User logged in (Python): {user.get('user_name')}")
    return RedirectResponse(url="/dashboard", status_code=303)


@app.post("/register")
def register_post(
    request: Request,
    username: str = Form(""),
    password: str = Form("")
):
    if not username.strip() or not password.strip():
        err = urllib.parse.quote("جميع الحقول مطلوبة")
        return RedirectResponse(url=f"/register?error={err}", status_code=303)
    
    clean = username.strip()
    if len(clean) < 3:
        err = urllib.parse.quote("اسم المستخدم يجب أن يكون 3 أحرف على الأقل")
        return RedirectResponse(url=f"/register?error={err}", status_code=303)
        
    existing = db.query_one("SELECT show_name FROM users WHERE user_name = %s", (clean,))
    if existing:
        err = urllib.parse.quote("اسم المستخدم مستخدم بالفعل")
        return RedirectResponse(url=f"/register?error={err}", status_code=303)
        
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db.execute_mod("INSERT INTO users (user_name, user_password) VALUES (%s, %s)", (clean, hashed))
    
    print(f"→ New user registered (Python): {clean}")
    succ = urllib.parse.quote("تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن")
    return RedirectResponse(url=f"/login?success={succ}", status_code=303)


def perform_logout(request: Request):
    request.session.clear()
    succ = urllib.parse.quote("تم تسجيل الخروج بنجاح")
    return RedirectResponse(url=f"/login?success={succ}", status_code=303)

@app.post("/logout")
@app.get("/logout")
def logout(request: Request):
    return perform_logout(request)


# ══════════════════════════════════════════════════════════════
#  DATA APIs
# ══════════════════════════════════════════════════════════════

@app.get("/api/warehouses")
def get_warehouses(request: Request, cat: str = Query("")):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})
    sql = "SELECT * FROM c_data WHERE cf_cat=18"
    params = []
    clean_cat = cat.strip()
    if clean_cat:
        sql += " AND (FIND_IN_SET(%s, cf_t5) > 0 OR cf_t5 LIKE %s)"
        like_cat = f"%,{clean_cat},%"
        params.extend([clean_cat, like_cat])
    sql += " ORDER BY cf_id"
    rows = db.query_all(sql, tuple(params))
    return {"success": True, "data": rows}


@app.get("/api/item-groups")
def get_item_groups(request: Request):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})
    rows = db.query_all("SELECT * FROM item_groups ")
    return {"success": True, "data": rows}


@app.get("/api/items")
def get_items(request: Request):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})
    rows = db.query_all("SELECT * FROM items ORDER BY item_id ")
    return {"success": True, "data": rows}


# ── Customers APIs ───────────────────────────────────────────

def handle_get_customers(request: Request, search: str = ""):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})
    
    clean_search = search.strip()
    sql = "SELECT cf_id, cf_t1, cf_t2, cf_t3, cf_t4, cf_t5, cf_n1 FROM c_data WHERE cf_cat = 4"
    params = []
    
    if clean_search:
        sql += " AND (cf_t1 LIKE %s OR cf_t5 LIKE %s OR CAST(cf_id AS CHAR) LIKE %s)"
        like = f"%{clean_search}%"
        params = [like, like, like]
        
    sql += " ORDER BY cf_id DESC LIMIT 50"
    rows = db.query_all(sql, tuple(params))
    return {"success": True, "data": rows, "allcnt": len(rows)}

@app.get("/customers")
@app.get("/api/customers")
def get_customers_route(request: Request, search: str = Query("")):
    return handle_get_customers(request, search)


async def handle_create_customer(request: Request):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})
    
    body = await request.json() if request.headers.get("content-type") == "application/json" else dict(await request.form())
    cf_t1 = str(body.get("cf_t1") or "").strip()
    cf_t2 = str(body.get("cf_t2") or "").strip()
    cf_t3 = str(body.get("cf_t3") or "").strip()
    cf_t4 = str(body.get("cf_t4") or "").strip()
    cf_t5 = str(body.get("cf_t5") or "").strip()
    cf_n1_raw = body.get("cf_n1")
    cf_n1 = int(cf_n1_raw) if cf_n1_raw and str(cf_n1_raw).isdigit() else None

    if not cf_t1:
        return JSONResponse(status_code=400, content={"success": False, "error": "اسم العميل مطلوب"})
    
    next_id=db.get_next_cdata_ser(4)
    
    uid = user.get("id")
    uname = user.get("username")

    db.execute_mod(
        """INSERT INTO c_data (cf_id, cf_cat, cf_t1, cf_t2, cf_t3, cf_t4, cf_t5, cf_n1, created_by, creator_name)
           VALUES (%s, 4, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (next_id, cf_t1, cf_t2, cf_t3, cf_t4, cf_t5, cf_n1, uid, uname)
    )

    new_row = db.query_one(
        "SELECT cf_id, cf_t1, cf_t2, cf_t3, cf_t4, cf_t5, cf_n1 FROM c_data WHERE cf_id = %s AND cf_cat = 4",
        (next_id,)
    )

    print(f"→ Customer created (Python) by {uname}: {cf_t1} (cf_id: {next_id})")
    return JSONResponse(status_code=201, content={"success": True, "message": "تم إضافة العميل بنجاح", "data": new_row})

@app.post("/customers")
@app.post("/api/customers")
async def create_customer_route(request: Request):
    return await handle_create_customer(request)


async def handle_update_customer(request: Request, cid: int):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})
    
    body = await request.json() if request.headers.get("content-type") == "application/json" else dict(await request.form())
    cf_t1 = str(body.get("cf_t1") or "").strip()
    cf_t2 = str(body.get("cf_t2") or "").strip()
    cf_t3 = str(body.get("cf_t3") or "").strip()
    cf_t4 = str(body.get("cf_t4") or "").strip()
    cf_t5 = str(body.get("cf_t5") or "").strip()
    cf_n1_raw = body.get("cf_n1")
    cf_n1 = int(cf_n1_raw) if cf_n1_raw and str(cf_n1_raw).isdigit() else None

    if not cf_t1:
        return JSONResponse(status_code=400, content={"success": False, "error": "اسم العميل مطلوب"})

    uid = user.get("id")
    uname = user.get("username")

    affected, _ = db.execute_mod(
        """UPDATE c_data SET cf_t1=%s, cf_t2=%s, cf_t3=%s, cf_t4=%s, cf_t5=%s, cf_n1=%s,
           edited_by=%s, editor_name=%s, edited_at=NOW()
           WHERE cf_id=%s AND cf_cat=4""",
        (cf_t1, cf_t2, cf_t3, cf_t4, cf_t5, cf_n1, uid, uname, cid)
    )

    if affected == 0:
        return JSONResponse(status_code=404, content={"success": False, "error": "العميل غير موجود"})

    row = db.query_one(
        "SELECT cf_id, cf_t1, cf_t2, cf_t3, cf_t4, cf_t5, cf_n1 FROM c_data WHERE cf_id = %s AND cf_cat = 4",
        (cid,)
    )
    return {"success": True, "message": "تم تحديث بيانات العميل بنجاح", "data": row}

@app.put("/customers/{cid}")
@app.put("/api/customers/{cid}")
@app.post("/customers/update/{cid}")
@app.post("/api/customers/update/{cid}")
async def update_customer_route(request: Request, cid: int):
    return await handle_update_customer(request, cid)


def handle_delete_customer(request: Request, cid: int):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})
    
    affected, _ = db.execute_mod("DELETE FROM c_data WHERE cf_id = %s AND cf_cat = 4", (cid,))
    if affected == 0:
        return JSONResponse(status_code=404, content={"success": False, "error": "العميل غير موجود"})
    
    print(f"→ Customer deleted (Python): cf_id {cid}")
    return {"success": True, "message": "تم حذف العميل بنجاح"}

@app.delete("/customers/{cid}")
@app.delete("/api/customers/{cid}")
@app.post("/customers/delete/{cid}")
@app.post("/api/customers/delete/{cid}")
def delete_customer_route(request: Request, cid: int):
    return handle_delete_customer(request, cid)


# ── Sales Documents Helper ───────────────────────────────────

def fetch_cash_documents(request: Request, search: str = "", include_posted: bool = False, single_cat: int = None):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})

    if single_cat == 0:
        return {"success": True, "data": [], "cnt": 0}

    sql = "SELECT cash_ser, cash_date, cash_cat, cash_cat_name, cash_cv_name, cash_amount, cash_notes FROM cash WHERE cash_posted < 7"

    params = []

    if single_cat is not None:
        sql += " AND cash_cat = %s"
        params.append(single_cat)

    clean_search = search.strip()
    if clean_search:
        sql += " AND (CAST(cash_ser AS CHAR) LIKE %s OR cash_cv_name LIKE %s OR cash_notes LIKE %s)"
        like = f"%{clean_search}%"
        params.extend([like, like, like])

    sql += " ORDER BY cash_ser DESC LIMIT 500"
    rows = db.query_all(sql, tuple(params))

    return {"success": True, "data": rows, "cnt": len(rows)}


@app.get("/documents")
@app.get("/api/documents")
def get_all_documents(request: Request, search: str = Query(""), cat: str = Query("5"), all: str = Query("true"), posted: str = Query("true")):
    inc_posted = (all.lower() != "false") and (posted.lower() != "false")
    single_cat = None
    clean_cat = cat.strip()
    if clean_cat:
        try:
            single_cat = int(clean_cat)
        except ValueError:
            pass
    return fetch_cash_documents(request, search=search, include_posted=inc_posted, single_cat=single_cat)






# ── Document Details API ─────────────────────────────────────

@app.get("/api/document/{ser}")
def get_document_details(request: Request, ser: str):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})

    if not ser:
        return JSONResponse(status_code=400, content={"success": False, "error": "رقم المستند مطلوب"})

    header = db.query_one("SELECT * FROM cash WHERE cash_ser = %s", (ser,))
    if not header:
        return JSONResponse(status_code=404, content={"success": False, "error": "المستند غير موجود"})

    # Fetch customer phone & address if cash_cv_id is present
    if header.get("cash_cv_id"):
        cust = db.query_one("SELECT cf_t2, cf_t3, cf_t4, cf_t5 FROM c_data WHERE cf_id = %s AND cf_cat = 4", (header["cash_cv_id"],))
        if cust:
            header["customer_phone"] = cust.get("cf_t5") or ""
            addr_parts = [str(p).strip() for p in [cust.get("cf_t2"), cust.get("cf_t3"), cust.get("cf_t4")] if p and str(p).strip()]
            header["customer_address"] = " - ".join(addr_parts)
        else:
            header["customer_phone"] = ""
            header["customer_address"] = ""
    else:
        header["customer_phone"] = ""
        header["customer_address"] = ""

    items = db.query_all(
        """SELECT 
            cd.row_no,
            cd.item_id, 
            i.item_name, 
            i.item_unit, 
            ABS(cd.item_qty) AS item_qty, 
            cd.item_price, 
            cd.cd_tot 
           FROM cash_details cd 
           LEFT JOIN items i ON cd.item_id = i.item_id 
           WHERE cd.cash_ser = %s
           ORDER BY cd.row_no ASC, cd.cd_id ASC""",
        (ser,)
    )

    return {"success": True, "header": header, "items": items}


# ── Delete Sales Document API ─────────────────────────────────

@app.delete("/api/document/{ser}")
@app.post("/api/document/delete/{ser}")
def delete_sales_document(request: Request, ser: str):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})

    if not ser:
        return JSONResponse(status_code=400, content={"success": False, "error": "رقم المستند مطلوب"})

    header = db.query_one("SELECT * FROM cash WHERE cash_ser = %s", (ser,))
    if not header:
        return JSONResponse(status_code=404, content={"success": False, "error": "المستند غير موجود"})

    db.execute_mod("DELETE FROM cash_details WHERE cash_ser = %s", (ser,))
    db.execute_mod("DELETE FROM cash WHERE cash_ser = %s", (ser,))

    return {"success": True, "message": "تم حذف المستند بنجاح"}


# ── Post Sales Document API ───────────────────────────────────

@app.post("/api/document/post/{ser}")
@app.put("/api/document/{ser}/post")
def post_sales_document(request: Request, ser: str):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})

    if not ser:
        return JSONResponse(status_code=400, content={"success": False, "error": "رقم المستند مطلوب"})

    header = db.query_one("SELECT * FROM cash WHERE cash_ser = %s", (ser,))
    if not header:
        return JSONResponse(status_code=404, content={"success": False, "error": "المستند غير موجود"})

    uname = user.get("username") or ""
    db.execute_mod("UPDATE cash SET cash_posted = 7, user_post = %s WHERE cash_ser = %s", (uname, ser))

    return {"success": True, "message": "تم ترحيل المستند بنجاح"}




# ── Items Search API (for combo) ─────────────────────────────

@app.get("/api/items/search")
def search_items(request: Request, q: str = Query(""), limit: int = Query(0)):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})
    sql = "SELECT item_id, item_name, item_unit, item_sell_price1 FROM items"
    params = []
    clean = q.strip()
    if clean:
        sql += " WHERE (item_name LIKE %s OR CAST(item_id AS CHAR) LIKE %s)"
        like = f"%{clean}%"
        params = [like, like]
    lim = limit if limit > 0 else (80 if clean else 10000)
    sql += f" ORDER BY item_id LIMIT {lim}"
    rows = db.query_all(sql, tuple(params))
    return {"success": True, "data": rows}


# ── Warehouses Search API (for combo) ────────────────────────

@app.get("/api/warehouses/search")
def search_warehouses(request: Request, q: str = Query(""), cat: str = Query(""), limit: int = Query(0)):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})
    sql = "SELECT cf_id, cf_t1, cf_t5 FROM c_data WHERE cf_cat = 18"
    params = []
    clean = q.strip()
    if clean:
        sql += " AND (cf_t1 LIKE %s OR CAST(cf_id AS CHAR) LIKE %s)"
        like = f"%{clean}%"
        params.extend([like, like])
    clean_cat = cat.strip()
    if clean_cat:
        sql += " AND (FIND_IN_SET(%s, cf_t5) > 0 OR cf_t5 LIKE %s)"
        like_cat = f"%,{clean_cat},%"
        params.extend([clean_cat, like_cat])
    lim = limit if limit > 0 else (50 if clean else 1000)
    sql += f" ORDER BY cf_id LIMIT {lim}"
    rows = db.query_all(sql, tuple(params))
    return {"success": True, "data": rows}


# ── Customers Combo Search API ────────────────────────────────

@app.get("/api/customers/search")
def search_customers_combo(request: Request, q: str = Query(""), limit: int = Query(0)):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})
    sql = "SELECT cf_id, cf_t1, cf_n1 FROM c_data WHERE cf_cat = 4"
    params = []
    clean = q.strip()
    if clean:
        sql += " AND (cf_t1 LIKE %s OR CAST(cf_id AS CHAR) LIKE %s)"
        like = f"%{clean}%"
        params = [like, like]
    lim = limit if limit > 0 else (60 if clean else 10000)
    sql += f" ORDER BY cf_id DESC LIMIT {lim}"
    rows = db.query_all(sql, tuple(params))
    return {"success": True, "data": rows}


@app.get("/api/agent/{agent_id}")
def get_agent_by_id(request: Request, agent_id: int):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})
    row = db.query_one("SELECT cf_id, cf_t1 FROM c_data WHERE cf_id = %s", (agent_id,))
    if row:
        return {"success": True, "data": {"agent_id": row["cf_id"], "agent_name": row["cf_t1"]}}
    return {"success": False, "error": "المندوب غير موجود"}


# ── Stock Availability API ────────────────────────────────────

@app.get("/api/stock/available")
def get_stock_available(request: Request, stock_id: int = Query(...), ser: str = Query("")):
    """Return items with positive stock in a given warehouse.
    When ser is provided (edit mode), effective_qty = cur_qty + qty already on that document."""
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})

    # Fetch current stock levels for this warehouse
    clean_ser = ser.strip()

    stock_sql = """
         SELECT i.item_id, i.item_name, i.item_unit, i.item_sell_price1, COALESCE(s.cur_qty, 0) AS cur_qty
        from items i
        LEFT JOIN ( 
        SELECT cd.item_id,
               SUM(cd.item_qty) AS cur_qty
        FROM cash_details cd
        WHERE cd.Stock_id = %s
        and cd.cash_ser != %s
        GROUP BY cd.item_id
        HAVING SUM(cd.item_qty) > 0 ) s on i.item_id = s.item_id order by i.item_name asc
    """
    stock_rows = db.query_all(stock_sql, (stock_id, clean_ser))
    result = []
    for r in stock_rows:
        cur_qty = float(r["cur_qty"] or 0)
        if cur_qty <= 0:
            continue
        result.append({
            "item_id": r["item_id"],
            "item_name": r["item_name"] or "",
            "item_unit": r["item_unit"] or "",
            "item_sell_price1": r["item_sell_price1"] or 0,
            "cur_qty": cur_qty,
        })

    return {"success": True, "data": result}


# ── Create Sales Document ─────────────────────────────────────

@app.post("/api/document")
async def create_sales_document(request: Request):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})

    body = await request.json()

    cash_cat       = int(body.get("cash_cat") or 0)
    cash_cat_name  = str(body.get("cash_cat_name") or "").strip()
    cash_date      = str(body.get("cash_date") or "").strip()
    cash_cv_id     = body.get("cash_cv_id")
    cash_cv_name   = str(body.get("cash_cv_name") or "").strip()
    cash_stock_id  = body.get("cash_stock_id")
    cash_stock_name= str(body.get("cash_stock_name") or "").strip()
    cash_agent_id  = body.get("cash_agent_id")
    cash_agent_name= str(body.get("cash_agent_name") or "").strip()
    cash_pay_method= str(body.get("cash_pay_method") or "").strip()
    cash_notes     = str(body.get("cash_notes") or "").strip()
    cash_discount  = float(body.get("cash_discount") or 0)
    items_list     = body.get("items") or []

    if not cash_cat or not cash_date or not cash_cv_id:
        return JSONResponse(status_code=400, content={"success": False,
            "error": "نوع المستند، التاريخ، والعميل حقول مطلوبة"})

    if not items_list:
        return JSONResponse(status_code=400, content={"success": False,
            "error": "يجب إضافة صنف واحد على الأقل"})

    cash_amount = sum(float(i.get("cd_tot") or 0) for i in items_list)
    net_amount  = max(0.0, cash_amount - cash_discount)
    user_id     = user.get("id")

    # ── Validate stock and save atomically ───────────────────
    violations = []

    def _create_txn(conn, cursor):
        nonlocal violations
        sid = cash_stock_id
        if sid:
            # Lock rows for this warehouse to prevent race conditions
            item_ids = [i.get("item_id") for i in items_list if i.get("item_id")]
            if item_ids:
                placeholders = ",".join(["%s"] * len(item_ids))
                cursor.execute(
                    f"""SELECT cd.item_id, SUM(cd.item_qty) AS cur_qty
                        FROM cash_details cd
                        WHERE cd.Stock_id = %s AND cd.item_id IN ({placeholders})
                        GROUP BY cd.item_id
                        FOR UPDATE""",
                    (sid, *item_ids)
                )
                stock_rows = cursor.fetchall()
                cur_qty_map = {r["item_id"]: float(r["cur_qty"]) for r in stock_rows}

                # Fetch item names for violation messages
                cursor.execute(f"SELECT item_id, item_name FROM items WHERE item_id IN ({placeholders})", tuple(item_ids))
                names_map = {r["item_id"]: r["item_name"] for r in cursor.fetchall()}

                for item in items_list:
                    iid = item.get("item_id")
                    if not iid:
                        continue
                    requested = float(item.get("item_qty") or 0)
                    available = cur_qty_map.get(iid, 0.0)
                    if requested > available:
                        violations.append({
                            "item_id": iid,
                            "item_name": names_map.get(iid, str(iid)),
                            "requested_qty": requested,
                            "cur_qty": available
                        })

                if violations:
                    raise ValueError("stock_violation")

        # Get next serial inside the transaction
        cursor.execute("SELECT MAX(cash_ser) AS max_ser FROM cash WHERE cash_cat = %s FOR UPDATE", (cash_cat,))
        row = cursor.fetchone()
        max_ser = row.get("max_ser") if row else None
        if max_ser and int(max_ser) > 0:
            new_ser = int(max_ser) + 1
        else:
            new_ser = (cash_cat * 10000 + 1) if cash_cat > 0 else 1

        cursor.execute(
            """INSERT INTO cash
               (cash_ser, cash_cat, cash_cat_name, cash_date,
                cash_cv_id, cash_cv_name, cash_stock_id, cash_stock_name,
                cash_agent_id, cash_agent_name, cash_pay_method, cash_notes,
                cash_amount, cash_discount, cash_posted, user_add)
               VALUES (%s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s, %s,%s,0,%s)""",
            (new_ser, cash_cat, cash_cat_name, cash_date,
             cash_cv_id or None, cash_cv_name, sid or None, cash_stock_name,
             cash_agent_id or None, cash_agent_name, cash_pay_method, cash_notes,
             net_amount, cash_discount, user_id)
        )

        for idx, item in enumerate(items_list, 1):
            row_no     = int(item.get("row_no") or idx)
            item_id    = item.get("item_id")
            item_price = float(item.get("item_price") or 0)
            item_qty   = float(item.get("item_qty") or 0)
            cd_tot_v   = float(item.get("cd_tot") or (item_price * item_qty))
            stock_id_v = item.get("stock_id") or sid
            if not item_id:
                continue
            # Positive qty for receipt/add-stock categories; negative for sales
            signed_qty = abs(item_qty) if cash_cat in POSITIVE_QTY_CATS else -abs(item_qty)
            cursor.execute(
                """INSERT INTO cash_details
                   (cash_ser, Stock_id, item_id, item_price, item_qty, cd_tot, cd_date, cd_cat, row_no)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (new_ser, stock_id_v or None, item_id, item_price, signed_qty, cd_tot_v,
                 cash_date, cash_cat, row_no)
            )

        return new_ser

    try:
        cash_ser = db.execute_transaction(_create_txn)
    except ValueError as e:
        if violations:
            return JSONResponse(status_code=422, content={
                "success": False,
                "error": "الكمية المطلوبة تتجاوز المخزون المتاح",
                "violations": violations
            })
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})
    except Exception as e:
        print(f"Error creating document: {e}")
        return JSONResponse(status_code=500, content={"success": False, "error": "خطأ في حفظ المستند"})

    print(f"→ Document created by {user.get('username')}: ser={cash_ser} cat={cash_cat} cv={cash_cv_name}")
    return JSONResponse(status_code=201, content={
        "success": True,
        "message": f"تم إنشاء المستند بنجاح – رقم المستند: {cash_ser}",
        "cash_ser": cash_ser
    })


# ── Update Sales Document ─────────────────────────────────────

@app.put("/api/document/{ser}")
async def update_sales_document(ser: str, request: Request):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})

    header = db.query_one("SELECT * FROM cash WHERE cash_ser = %s", (ser,))
    if not header:
        return JSONResponse(status_code=404, content={"success": False, "error": "المستند غير موجود"})

    if (header.get("cash_posted") or 0) >= 7:
        return JSONResponse(status_code=400, content={"success": False, "error": "المستند مرحل ولا يمكن تعديله"})

    body = await request.json()

    cash_cat       = int(body.get("cash_cat") or header.get("cash_cat") or 0)
    cash_cat_name  = str(body.get("cash_cat_name") or header.get("cash_cat_name") or "").strip()
    cash_date      = str(body.get("cash_date") or "").strip()
    cash_cv_id     = body.get("cash_cv_id")
    cash_cv_name   = str(body.get("cash_cv_name") or "").strip()
    cash_stock_id  = body.get("cash_stock_id")
    cash_stock_name= str(body.get("cash_stock_name") or "").strip()
    cash_agent_id  = body.get("cash_agent_id")
    cash_agent_name= str(body.get("cash_agent_name") or "").strip()
    cash_pay_method= str(body.get("cash_pay_method") or "").strip()
    cash_notes     = str(body.get("cash_notes") or "").strip()
    cash_discount  = float(body.get("cash_discount") or 0)
    items_list     = body.get("items") or []

    if not cash_date or not cash_cv_id:
        return JSONResponse(status_code=400, content={"success": False, "error": "التاريخ والعميل حقول مطلوبة"})

    if not items_list:
        return JSONResponse(status_code=400, content={"success": False, "error": "يجب إضافة صنف واحد على الأقل"})

    cash_amount = sum(float(i.get("cd_tot") or 0) for i in items_list)
    net_amount  = max(0.0, cash_amount - cash_discount)
    user_id     = user.get("id") or user.get("username")

    violations = []

    def _update_txn(conn, cursor):
        nonlocal violations
        sid = cash_stock_id

        if sid:
            item_ids = [i.get("item_id") for i in items_list if i.get("item_id")]
            if item_ids:
                placeholders = ",".join(["%s"] * len(item_ids))

                # Lock current stock rows
                cursor.execute(
                    f"""SELECT cd.item_id, SUM(cd.item_qty) AS cur_qty
                        FROM cash_details cd
                        WHERE cd.Stock_id = %s AND cd.item_id IN ({placeholders})
                        GROUP BY cd.item_id
                        FOR UPDATE""",
                    (sid, *item_ids)
                )
                stock_rows = cursor.fetchall()
                cur_qty_map = {r["item_id"]: float(r["cur_qty"]) for r in stock_rows}

                # Fetch existing quantities on THIS document (to add back)
                cursor.execute(
                    f"SELECT item_id, ABS(item_qty) AS item_qty FROM cash_details WHERE cash_ser = %s AND Stock_id = %s AND item_id IN ({placeholders})",
                    (ser, sid, *item_ids)
                )
                doc_rows = cursor.fetchall()
                doc_qty_map = {}
                for r in doc_rows:
                    iid = r["item_id"]
                    doc_qty_map[iid] = doc_qty_map.get(iid, 0) + float(r["item_qty"])

                # Fetch item names for violation messages
                cursor.execute(f"SELECT item_id, item_name FROM items WHERE item_id IN ({placeholders})", tuple(item_ids))
                names_map = {r["item_id"]: r["item_name"] for r in cursor.fetchall()}

                for item in items_list:
                    iid = item.get("item_id")
                    if not iid:
                        continue
                    requested = float(item.get("item_qty") or 0)
                    cur_qty = cur_qty_map.get(iid, 0.0)
                    doc_qty = doc_qty_map.get(iid, 0.0)
                    effective_qty = cur_qty + doc_qty
                    if requested > effective_qty:
                        violations.append({
                            "item_id": iid,
                            "item_name": names_map.get(iid, str(iid)),
                            "requested_qty": requested,
                            "cur_qty": effective_qty
                        })

                if violations:
                    raise ValueError("stock_violation")

        cursor.execute(
            """UPDATE cash SET
                cash_cat = %s, cash_cat_name = %s, cash_date = %s,
                cash_cv_id = %s, cash_cv_name = %s, cash_stock_id = %s, cash_stock_name = %s,
                cash_agent_id = %s, cash_agent_name = %s, cash_pay_method = %s, cash_notes = %s,
                cash_amount = %s, cash_discount = %s, user_edit = %s
               WHERE cash_ser = %s""",
            (cash_cat, cash_cat_name, cash_date,
             cash_cv_id or None, cash_cv_name, sid or None, cash_stock_name,
             cash_agent_id or None, cash_agent_name, cash_pay_method, cash_notes,
             net_amount, cash_discount, user_id, ser)
        )

        cursor.execute("DELETE FROM cash_details WHERE cash_ser = %s", (ser,))

        for idx, item in enumerate(items_list, 1):
            row_no     = int(item.get("row_no") or idx)
            item_id    = item.get("item_id")
            item_price = float(item.get("item_price") or 0)
            item_qty   = float(item.get("item_qty") or 0)
            cd_tot_v   = float(item.get("cd_tot") or (item_price * item_qty))
            stock_id_v = item.get("stock_id") or sid
            if not item_id:
                continue
            # Positive qty for receipt/add-stock categories; negative for sales
            signed_qty = abs(item_qty) if cash_cat in POSITIVE_QTY_CATS else -abs(item_qty)
            cursor.execute(
                """INSERT INTO cash_details
                   (cash_ser, Stock_id, item_id, item_price, item_qty, cd_tot, cd_date, cd_cat, row_no)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (ser, stock_id_v or None, item_id, item_price, signed_qty, cd_tot_v,
                 cash_date, cash_cat, row_no)
            )

        return ser

    try:
        db.execute_transaction(_update_txn)
    except ValueError:
        if violations:
            return JSONResponse(status_code=422, content={
                "success": False,
                "error": "الكمية المطلوبة تتجاوز المخزون المتاح",
                "violations": violations
            })
        return JSONResponse(status_code=400, content={"success": False, "error": "خطأ في التحقق من المخزون"})
    except Exception as e:
        print(f"Error updating document: {e}")
        return JSONResponse(status_code=500, content={"success": False, "error": "خطأ في حفظ المستند"})

    print(f"→ Document updated by {user.get('username')}: ser={ser} cat={cash_cat} cv={cash_cv_name}")
    return JSONResponse(status_code=200, content={
        "success": True,
        "message": f"تم تعديل المستند رقم {ser} بنجاح",
        "cash_ser": ser
    })


# ── Stats API ────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats(request: Request):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})

#     u_cnt = db.query_one("SELECT COUNT(*) as c FROM users").get("c", 0)
#     w_cnt = db.query_one("SELECT COUNT(*) as c FROM c_data WHERE cf_cat = 18").get("c", 0)
#     i_cnt = db.query_one("SELECT COUNT(*) as c FROM items").get("c", 0)
#     g_cnt = db.query_one("SELECT COUNT(*) as c FROM item_groups").get("c", 0)
#     c_cnt = db.query_one("SELECT COUNT(*) as c FROM c_data WHERE cf_cat = 4").get("c", 0)
#     s_cnt = db.query_one("SELECT COUNT(*) as c FROM cash WHERE cash_cat IN (5, 55, 57, 89, 111) AND cash_posted < 7").get("c", 0)

    u_cnt = 10
    w_cnt = 20
    i_cnt = 30
    g_cnt = 40
    c_cnt = 50
    s_cnt = 60

    return {
        "success": True,
        "data": {
            "userCount": u_cnt,
            "warehouseCount": w_cnt,
            "itemCount": i_cnt,
            "groupCount": g_cnt,
            "customerCount": c_cnt,
            "salesInvoiceCount": s_cnt
        }
    }


# ── Unified Inventory Adjustments APIs (cash_cat = 12 for Up, 43 for Down) ─────

def _get_adjustments_list(request: Request, cash_cat: int, search: str):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})

    sql = "SELECT cash_ser, cash_date, cash_stock_id, cash_stock_name, cash_notes FROM cash WHERE cash_cat = %s AND cash_posted < 7"
    params = [cash_cat]

    clean_search = search.strip()
    if clean_search:
        sql += " AND (CAST(cash_ser AS CHAR) LIKE %s OR cash_stock_name LIKE %s OR cash_notes LIKE %s)"
        like = f"%{clean_search}%"
        params.extend([like, like, like])

    sql += " ORDER BY cash_ser DESC LIMIT 500"
    rows = db.query_all(sql, tuple(params))
    return {"success": True, "data": rows, "cnt": len(rows)}


def _get_next_adjustment_ser(request: Request, cash_cat: int):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})
    next_ser = db.get_next_cash_ser(cash_cat)
    return {"success": True, "next_ser": next_ser}


def _get_adjustment_details(request: Request, ser: str, default_cat: int = 12):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})

    if not ser:
        return JSONResponse(status_code=400, content={"success": False, "error": "رقم المستند مطلوب"})

    header = db.query_one(
        "SELECT cash_ser, cash_date, cash_stock_id, cash_stock_name, cash_notes, cash_cat_name, cash_cat FROM cash WHERE cash_ser = %s AND cash_cat = %s",
        (ser, default_cat)
    )
    if not header:
        header = db.query_one(
            "SELECT cash_ser, cash_date, cash_stock_id, cash_stock_name, cash_notes, cash_cat_name, cash_cat FROM cash WHERE cash_ser = %s AND cash_cat IN (12, 43)",
            (ser,)
        )
    if not header:
        header = db.query_one(
            "SELECT cash_ser, cash_date, cash_stock_id, cash_stock_name, cash_notes, cash_cat_name, cash_cat FROM cash WHERE cash_ser = %s",
            (ser,)
        )

    if not header:
        return JSONResponse(status_code=404, content={"success": False, "error": "المستند غير موجود"})

    items = db.query_all(
        """SELECT 
            cd.row_no,
            cd.item_id, 
            i.item_name, 
            i.item_unit, 
            ABS(cd.item_qty) AS item_qty
           FROM cash_details cd 
           LEFT JOIN items i ON cd.item_id = i.item_id 
           WHERE cd.cash_ser = %s
           ORDER BY cd.row_no ASC, cd.cd_id ASC""",
        (ser,)
    )

    return {"success": True, "header": header, "items": items}


async def _save_adjustment(request: Request, default_cat: int, is_update: bool = False, ser: str = None):
    user = get_session_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": "غير مصرح"})

    body = await request.json()

    cash_cat = int(body.get("cash_cat") or default_cat)
    cat_name = "تسوية تخفيض" if cash_cat == 43 else "تسوية زيادة"
    cash_date       = str(body.get("cash_date") or "").strip()
    cash_stock_id   = body.get("cash_stock_id")
    cash_stock_name = str(body.get("cash_stock_name") or "").strip()
    cash_notes      = str(body.get("cash_notes") or "").strip()
    items_list      = body.get("items") or []

    if not cash_date:
        return JSONResponse(status_code=400, content={"success": False, "error": "تاريخ المستند مطلوب"})

    if not items_list:
        return JSONResponse(status_code=400, content={"success": False, "error": "يجب إضافة صنف واحد على الأقل"})

    user_id = user.get("id") or user.get("username")

    if is_update:
        header = db.query_one("SELECT * FROM cash WHERE cash_ser = %s AND cash_cat = %s", (ser, cash_cat))
        if not header:
            header = db.query_one("SELECT * FROM cash WHERE cash_ser = %s", (ser,))
        if not header:
            return JSONResponse(status_code=404, content={"success": False, "error": "المستند غير موجود"})

        if (header.get("cash_posted") or 0) >= 7:
            return JSONResponse(status_code=400, content={"success": False, "error": "المستند مرحل ولا يمكن تعديله"})

        cash_ser = ser
        db.execute_mod(
            """UPDATE cash SET
                cash_date = %s, cash_stock_id = %s, cash_stock_name = %s, cash_notes = %s, user_edit = %s
               WHERE cash_ser = %s""",
            (cash_date, cash_stock_id or None, cash_stock_name, cash_notes, user_id, cash_ser)
        )
        db.execute_mod("DELETE FROM cash_details WHERE cash_ser = %s", (cash_ser,))
    else:
        cash_ser = db.get_next_cash_ser(cash_cat)
        db.execute_mod(
            """INSERT INTO cash
               (cash_ser, cash_cat, cash_cat_name, cash_date,
                cash_stock_id, cash_stock_name, cash_notes, cash_posted, user_add)
               VALUES (%s, %s, %s, %s, %s, %s, %s, 0, %s)""",
            (cash_ser, cash_cat, cat_name, cash_date, cash_stock_id or None, cash_stock_name, cash_notes, user_id)
        )

    for idx, item in enumerate(items_list, 1):
        row_no   = int(item.get("row_no") or idx)
        item_id  = item.get("item_id")
        raw_qty  = float(item.get("item_qty") or 0)
        item_qty = -abs(raw_qty) if cash_cat == 43 else abs(raw_qty)
        stock_id = cash_stock_id
        if not item_id:
            continue
        db.execute_mod(
            """INSERT INTO cash_details
               (cash_ser, Stock_id, item_id, item_qty, cd_date, cd_cat, row_no)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (cash_ser, stock_id or None, item_id, item_qty, cash_date, cash_cat, row_no)
        )

    action_str = "تعديل" if is_update else "إنشاء"
    print(f"→ Adjustment ({cat_name}) {action_str} by {user.get('username')}: ser={cash_ser} stock={cash_stock_name}")
    status_code = 200 if is_update else 201
    return JSONResponse(status_code=status_code, content={
        "success": True,
        "message": f"تم {action_str} {cat_name} بنجاح – رقم المستند: {cash_ser}",
        "cash_ser": cash_ser
    })


# ── Endpoint Routes (delegating to unified helpers) ───────────

@app.get("/api/inventory/adjustments-up")
def get_adjustments_up(request: Request, search: str = Query("")):
    return _get_adjustments_list(request, 12, search)

@app.get("/api/inventory/adjustments-down")
def get_adjustments_down(request: Request, search: str = Query("")):
    return _get_adjustments_list(request, 43, search)

@app.get("/api/inventory/adjustments-up/next-ser")
def get_next_adjustment_up_ser(request: Request):
    return _get_next_adjustment_ser(request, 12)

@app.get("/api/inventory/adjustments-down/next-ser")
def get_next_adjustment_down_ser(request: Request):
    return _get_next_adjustment_ser(request, 43)

@app.get("/api/inventory/adjustment/{ser}")
def get_adjustment_details(request: Request, ser: str):
    return _get_adjustment_details(request, ser, default_cat=12)

@app.get("/api/inventory/adjustment-down/{ser}")
def get_adjustment_down_details(request: Request, ser: str):
    return _get_adjustment_details(request, ser, default_cat=43)

@app.post("/api/inventory/adjustment")
async def create_adjustment(request: Request):
    return await _save_adjustment(request, default_cat=12, is_update=False)

@app.post("/api/inventory/adjustment-down")
async def create_adjustment_down(request: Request):
    return await _save_adjustment(request, default_cat=43, is_update=False)

@app.put("/api/inventory/adjustment/{ser}")
async def update_adjustment(ser: str, request: Request):
    return await _save_adjustment(request, default_cat=12, is_update=True, ser=ser)

@app.put("/api/inventory/adjustment-down/{ser}")
async def update_adjustment_down(ser: str, request: Request):
    return await _save_adjustment(request, default_cat=43, is_update=True, ser=ser)




