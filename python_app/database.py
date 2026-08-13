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
