"""Validate every ESPI resource inside an Atom feed against schema/espi.xsd (corrected copy).
Usage: python3 reference/validate_schema.py <file.xml> [...]"""
import sys, copy, collections, pathlib
from lxml import etree
here = pathlib.Path(__file__).resolve().parent.parent / 'schema'
schema = etree.XMLSchema(etree.parse(str(here / 'espi.xsd')))
A = '{http://www.w3.org/2005/Atom}'; E = 'http://naesb.org/espi'
rc = 0
for f in sys.argv[1:]:
    n = collections.Counter(); bad = []
    try:
        for _, el in etree.iterparse(f, tag=A + 'entry'):
            c = el.find(A + 'content')
            for ch in (c if c is not None else []):
                if etree.QName(ch).namespace != E: continue
                n[etree.QName(ch).localname] += 1
                if not schema.validate(etree.ElementTree(copy.deepcopy(ch))): bad.append(str(schema.error_log.last_error))
            el.clear()
    except etree.XMLSyntaxError as e: bad.append(f'not well-formed: {e}')
    ok = not bad and sum(n.values()) > 0
    print(('VALID  ' if ok else 'INVALID') , f, dict(n), bad[:3])
    rc |= (not ok)
sys.exit(rc)
