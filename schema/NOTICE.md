# ESPI schema

`espi.xsd` is the NAESB REQ.21 Energy Services Provider Interface (ESPI) schema, version 4.0,
published December 13, 2023. Copyright 2019-2023 North American Energy Standards Board,
licensed under the Apache License, Version 2.0 (see the notice inside the file).

## Changes made in this copy

1. **Added the default namespace declaration** `xmlns="http://naesb.org/espi"` to the root
   `<xs:schema>` element. The copy we received lacked it, so every unprefixed type reference
   (for example `type="IntervalReading"`) resolved to no namespace and strict validators
   (libxml2) refused to load the schema. It is not known whether the official download has
   the same omission.
2. **Pointed the Atom import at `atom-stub.xsd`**, an empty schema for the Atom namespace.
   None of the ESPI types reference Atom types, so this validates every ESPI resource fully;
   the Atom wrapper (`feed`, `entry`, `link`) is checked separately by the app's parser.

Validation is done per ESPI resource (the child of each `<atom:content>`), see
`reference/validate_schema.py`.
