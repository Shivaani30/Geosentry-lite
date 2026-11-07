from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext
from sqlmodel import Session, select
from models import User
from database import get_session
from auth import create_token

router = APIRouter()
pwd = CryptContext(schemes=["bcrypt"])

@router.post("/signup")
def signup(user: User, session: Session = Depends(get_session)):
    if session.exec(select(User).where(User.username == user.username)).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    if not user.username.strip() or not user.password or len(user.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Username and password are required; password must be at most 72 UTF-8 bytes")
    user.password = pwd.hash(user.password)
    session.add(user)
    session.commit()
    return {"message": "Account created"}

@router.post("/login")
def login(data: User, session: Session = Depends(get_session)):
    if len(data.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=401, detail="Invalid login")
    stmt = select(User).where(User.username == data.username)
    db_user = session.exec(stmt).first()

    if not db_user or not pwd.verify(data.password, db_user.password):
        raise HTTPException(status_code=401, detail="Invalid login")

    token = create_token({"id": db_user.id})
    return {"token": token}
