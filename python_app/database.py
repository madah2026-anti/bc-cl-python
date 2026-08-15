# ============================================================
# database.py – MariaDB/PyMySQL connection helper
# ============================================================
import os
import pymysql
import pymysql.cursors
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "madah")
DB_PASSWORD = os.getenv("DB_PASSWORD", "123456")
DB_NAME = os.getenv("DB_NAME", "bc22")

def get_connection():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True
    )

def query_all(sql: str, params: tuple = ()):
    conn = get_connection()
    try:
        print(f"🔍 query_all: {sql} | [PARAMS]: {params}")

        with conn.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()
    finally:
        conn.close()

def query_one(sql: str, params: tuple = ()):
    conn = get_connection()


    try:
        print(f"🔍 query_one : {sql} | [PARAMS]: {params}")

        with conn.cursor() as cursor:
            cursor.execute(sql, params)
            
            return cursor.fetchone()
    finally:
        conn.close()

def execute_mod(sql: str, params: tuple = ()):
    conn = get_connection()
    try:
        print(f"🔍 execute_mod : {sql} | [PARAMS]: {params}")

        with conn.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.rowcount, cursor.lastrowid
    finally:
        conn.close()

def get_next_cash_ser(tmpcashcat):
    conn = get_connection()

    try:
        print(f"🔍 getting next cash ser for category: {tmpcashcat}")

        with conn.cursor() as cursor:
            cursor.execute("SELECT MAX(cash_ser) AS max_ser FROM cash WHERE cash_cat = %s", (tmpcashcat,))
            row = cursor.fetchone()
            max_ser = row.get("max_ser") if row else None

            if max_ser is not None and max_ser > 0:
                return int(max_ser) + 1

            try:
                cat_num = int(tmpcashcat)
            except (ValueError, TypeError):
                cat_num = 0

            return (cat_num * 10000 + 1) if cat_num > 0 else 1
    finally:
        conn.close()


def execute_transaction(fn):
    """
    Run fn(conn, cursor) inside an atomic transaction.
    fn should return a value on success.
    If fn raises, the transaction is rolled back and the exception re-raised.
    """
    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False
    )
    try:
        with conn.cursor() as cursor:
            result = fn(conn, cursor)
        conn.commit()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
