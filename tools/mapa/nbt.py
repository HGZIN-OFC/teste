# Leitor NBT mínimo (Java Edition), suficiente para level.dat e chunks de regiões .mca
import struct
TAG_END,TAG_BYTE,TAG_SHORT,TAG_INT,TAG_LONG,TAG_FLOAT,TAG_DOUBLE,TAG_BYTE_ARRAY,TAG_STRING,TAG_LIST,TAG_COMPOUND,TAG_INT_ARRAY,TAG_LONG_ARRAY=range(13)
class R:
    def __init__(s,b): s.b=b; s.p=0
    def u(s,fmt):
        n=struct.calcsize(fmt); v=struct.unpack_from(fmt,s.b,s.p); s.p+=n; return v[0]
def _payload(r,t):
    if t==TAG_BYTE: return r.u('>b')
    if t==TAG_SHORT: return r.u('>h')
    if t==TAG_INT: return r.u('>i')
    if t==TAG_LONG: return r.u('>q')
    if t==TAG_FLOAT: return r.u('>f')
    if t==TAG_DOUBLE: return r.u('>d')
    if t==TAG_BYTE_ARRAY:
        n=r.u('>i'); v=r.b[r.p:r.p+n]; r.p+=n; return bytearray(v)
    if t==TAG_STRING:
        n=r.u('>H'); v=r.b[r.p:r.p+n].decode('utf-8','replace'); r.p+=n; return v
    if t==TAG_LIST:
        et=r.u('>b'); n=r.u('>i'); return [_payload(r,et) for _ in range(n)]
    if t==TAG_COMPOUND:
        d={}
        while True:
            tt=r.u('>b')
            if tt==TAG_END: return d
            name=_payload(r,TAG_STRING); d[name]=_payload(r,tt)
    if t==TAG_INT_ARRAY:
        n=r.u('>i'); v=struct.unpack_from('>%di'%n,r.b,r.p); r.p+=4*n; return list(v)
    if t==TAG_LONG_ARRAY:
        n=r.u('>i'); v=struct.unpack_from('>%dq'%n,r.b,r.p); r.p+=8*n; return list(v)
    raise ValueError('tag %d'%t)
def read_named(data):
    r=R(data); t=r.u('>b'); name=_payload(r,TAG_STRING); return name,_payload(r,t)
