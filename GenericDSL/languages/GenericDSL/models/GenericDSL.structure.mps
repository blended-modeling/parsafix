<?xml version="1.0" encoding="UTF-8"?>
<model ref="r:1b5f3847-45e0-4e0f-b52a-14863b12b412(GenericDSL.structure)">
  <persistence version="9" />
  <languages>
    <use id="c72da2b9-7cce-4447-8389-f407dc1158b7" name="jetbrains.mps.lang.structure" version="9" />
    <devkit ref="78434eb8-b0e5-444b-850d-e7c4ad2da9ab(jetbrains.mps.devkit.aspect.structure)" />
  </languages>
  <imports>
    <import index="tpck" ref="r:00000000-0000-4000-0000-011c89590288(jetbrains.mps.lang.core.structure)" implicit="true" />
  </imports>
  <registry>
    <language id="c72da2b9-7cce-4447-8389-f407dc1158b7" name="jetbrains.mps.lang.structure">
      <concept id="1169125787135" name="jetbrains.mps.lang.structure.structure.AbstractConceptDeclaration" flags="ig" index="PkWjJ">
        <property id="6714410169261853888" name="conceptId" index="EcuMT" />
        <property id="4628067390765907488" name="conceptShortDescription" index="R4oN_" />
        <property id="5092175715804935370" name="conceptAlias" index="34LRSv" />
        <child id="1071489727083" name="linkDeclaration" index="1TKVEi" />
      </concept>
      <concept id="1169125989551" name="jetbrains.mps.lang.structure.structure.InterfaceConceptDeclaration" flags="ig" index="PlHQZ" />
      <concept id="1169127622168" name="jetbrains.mps.lang.structure.structure.InterfaceConceptReference" flags="ig" index="PrWs8">
        <reference id="1169127628841" name="intfc" index="PrY4T" />
      </concept>
      <concept id="1071489090640" name="jetbrains.mps.lang.structure.structure.ConceptDeclaration" flags="ig" index="1TIwiD">
        <property id="1096454100552" name="rootable" index="19KtqR" />
        <reference id="1071489389519" name="extends" index="1TJDcQ" />
        <child id="1169129564478" name="implements" index="PzmwI" />
      </concept>
      <concept id="1071489288298" name="jetbrains.mps.lang.structure.structure.LinkDeclaration" flags="ig" index="1TJgyj">
        <property id="1071599776563" name="role" index="20kJfa" />
        <property id="1071599893252" name="sourceCardinality" index="20lbJX" />
        <property id="1071599937831" name="metaClass" index="20lmBu" />
        <property id="241647608299431140" name="linkId" index="IQ2ns" />
        <reference id="1071599976176" name="target" index="20lvS9" />
      </concept>
    </language>
    <language id="ceab5195-25ea-4f22-9b92-103b95ca8c0c" name="jetbrains.mps.lang.core">
      <concept id="1169194658468" name="jetbrains.mps.lang.core.structure.INamedConcept" flags="ng" index="TrEIO">
        <property id="1169194664001" name="name" index="TrG5h" />
      </concept>
    </language>
  </registry>
  <node concept="1TIwiD" id="5w2nDnaB6ww">
    <property role="EcuMT" value="6341735222733465632" />
    <property role="TrG5h" value="Parent" />
    <property role="34LRSv" value="parent" />
    <property role="R4oN_" value="Parent of a child element" />
    <ref role="1TJDcQ" to="tpck:gw2VY9q" resolve="BaseConcept" />
    <node concept="PrWs8" id="5w2nDnaB6wx" role="PzmwI">
      <ref role="PrY4T" to="tpck:h0TrEE$" resolve="INamedConcept" />
    </node>
    <node concept="PrWs8" id="5w2nDnaBn_K" role="PzmwI">
      <ref role="PrY4T" node="5w2nDnaB6w$" resolve="IContent" />
    </node>
    <node concept="1TJgyj" id="5w2nDnaB6wG" role="1TKVEi">
      <property role="IQ2ns" value="6341735222733465644" />
      <property role="20lmBu" value="fLJjDmT/aggregation" />
      <property role="20kJfa" value="children" />
      <property role="20lbJX" value="fLJekj5/_0__n" />
      <ref role="20lvS9" node="5w2nDnaB6wD" resolve="Child" />
    </node>
  </node>
  <node concept="1TIwiD" id="5w2nDnaB6wz">
    <property role="EcuMT" value="6341735222733465635" />
    <property role="TrG5h" value="Root" />
    <property role="19KtqR" value="true" />
    <property role="34LRSv" value="root" />
    <property role="R4oN_" value="Root of the model" />
    <ref role="1TJDcQ" to="tpck:gw2VY9q" resolve="BaseConcept" />
    <node concept="1TJgyj" id="5w2nDnaB6w_" role="1TKVEi">
      <property role="IQ2ns" value="6341735222733465637" />
      <property role="20lmBu" value="fLJjDmT/aggregation" />
      <property role="20kJfa" value="content" />
      <property role="20lbJX" value="fLJekj5/_0__n" />
      <ref role="20lvS9" node="5w2nDnaB6w$" resolve="IContent" />
    </node>
    <node concept="PrWs8" id="5w2nDnaB6wB" role="PzmwI">
      <ref role="PrY4T" to="tpck:h0TrEE$" resolve="INamedConcept" />
    </node>
  </node>
  <node concept="PlHQZ" id="5w2nDnaB6w$">
    <property role="EcuMT" value="6341735222733465636" />
    <property role="TrG5h" value="IContent" />
  </node>
  <node concept="1TIwiD" id="5w2nDnaB6wD">
    <property role="EcuMT" value="6341735222733465641" />
    <property role="TrG5h" value="Child" />
    <property role="34LRSv" value="child" />
    <property role="R4oN_" value="Child of a parent element" />
    <ref role="1TJDcQ" to="tpck:gw2VY9q" resolve="BaseConcept" />
    <node concept="PrWs8" id="5w2nDnaB6wE" role="PzmwI">
      <ref role="PrY4T" to="tpck:h0TrEE$" resolve="INamedConcept" />
    </node>
  </node>
</model>

