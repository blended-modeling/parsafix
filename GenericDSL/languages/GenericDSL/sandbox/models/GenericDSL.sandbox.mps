<?xml version="1.0" encoding="UTF-8"?>
<model ref="r:6abd1afb-b5f3-4177-bb3f-828c25de93c8(GenericDSL.sandbox)">
  <persistence version="9" />
  <languages>
    <use id="7a5361d8-8b2b-4f3a-a89a-5c606c9b345b" name="GenericDSL" version="0" />
  </languages>
  <imports />
  <registry>
    <language id="7a5361d8-8b2b-4f3a-a89a-5c606c9b345b" name="GenericDSL">
      <concept id="6341735222733465632" name="GenericDSL.structure.Parent" flags="ng" index="2iBzqP">
        <child id="6341735222733465644" name="children" index="2iBzqT" />
      </concept>
      <concept id="6341735222733465635" name="GenericDSL.structure.Root" flags="ng" index="2iBzqQ">
        <child id="6341735222733465637" name="content" index="2iBzqK" />
      </concept>
      <concept id="6341735222733465641" name="GenericDSL.structure.Child" flags="ng" index="2iBzqW" />
    </language>
    <language id="ceab5195-25ea-4f22-9b92-103b95ca8c0c" name="jetbrains.mps.lang.core">
      <concept id="1169194658468" name="jetbrains.mps.lang.core.structure.INamedConcept" flags="ng" index="TrEIO">
        <property id="1169194664001" name="name" index="TrG5h" />
      </concept>
    </language>
  </registry>
  <node concept="2iBzqQ" id="5w2nDnaBnnZ">
    <property role="TrG5h" value="test" />
    <node concept="2iBzqP" id="5w2nDnaBnQ7" role="2iBzqK">
      <property role="TrG5h" value="parent1" />
      <node concept="2iBzqW" id="5w2nDnaBnQ9" role="2iBzqT">
        <property role="TrG5h" value="child1" />
      </node>
      <node concept="2iBzqW" id="5w2nDnaBnQb" role="2iBzqT">
        <property role="TrG5h" value="child2" />
      </node>
    </node>
    <node concept="2iBzqP" id="5w2nDnaBnQj" role="2iBzqK">
      <property role="TrG5h" value="parent2" />
      <node concept="2iBzqW" id="5w2nDnaBnQp" role="2iBzqT">
        <property role="TrG5h" value="child1" />
      </node>
    </node>
  </node>
</model>

