<?xml version="1.0" encoding="UTF-8"?>
<model ref="r:505a81a9-a2c1-4b3f-a295-f34e97852bd2(GenericDSL.editor)">
  <persistence version="9" />
  <languages>
    <use id="18bc6592-03a6-4e29-a83a-7ff23bde13ba" name="jetbrains.mps.lang.editor" version="14" />
    <devkit ref="fbc25dd2-5da4-483a-8b19-70928e1b62d7(jetbrains.mps.devkit.general-purpose)" />
  </languages>
  <imports>
    <import index="uaqk" ref="r:1b5f3847-45e0-4e0f-b52a-14863b12b412(GenericDSL.structure)" implicit="true" />
    <import index="tpck" ref="r:00000000-0000-4000-0000-011c89590288(jetbrains.mps.lang.core.structure)" implicit="true" />
  </imports>
  <registry>
    <language id="18bc6592-03a6-4e29-a83a-7ff23bde13ba" name="jetbrains.mps.lang.editor">
      <concept id="1071666914219" name="jetbrains.mps.lang.editor.structure.ConceptEditorDeclaration" flags="ig" index="24kQdi" />
      <concept id="1140524381322" name="jetbrains.mps.lang.editor.structure.CellModel_ListWithRole" flags="ng" index="2czfm3">
        <child id="1140524464360" name="cellLayout" index="2czzBx" />
      </concept>
      <concept id="1106270549637" name="jetbrains.mps.lang.editor.structure.CellLayout_Horizontal" flags="nn" index="2iRfu4" />
      <concept id="1106270571710" name="jetbrains.mps.lang.editor.structure.CellLayout_Vertical" flags="nn" index="2iRkQZ" />
      <concept id="1080736578640" name="jetbrains.mps.lang.editor.structure.BaseEditorComponent" flags="ig" index="2wURMF">
        <child id="1080736633877" name="cellModel" index="2wV5jI" />
      </concept>
      <concept id="1186414928363" name="jetbrains.mps.lang.editor.structure.SelectableStyleSheetItem" flags="ln" index="VPM3Z" />
      <concept id="1139848536355" name="jetbrains.mps.lang.editor.structure.CellModel_WithRole" flags="ng" index="1$h60E">
        <reference id="1140103550593" name="relationDeclaration" index="1NtTu8" />
      </concept>
      <concept id="1073389446423" name="jetbrains.mps.lang.editor.structure.CellModel_Collection" flags="sn" stub="3013115976261988961" index="3EZMnI">
        <child id="1106270802874" name="cellLayout" index="2iSdaV" />
        <child id="1073389446424" name="childCellModel" index="3EZMnx" />
      </concept>
      <concept id="1073389577006" name="jetbrains.mps.lang.editor.structure.CellModel_Constant" flags="sn" stub="3610246225209162225" index="3F0ifn">
        <property id="1073389577007" name="text" index="3F0ifm" />
      </concept>
      <concept id="1073389658414" name="jetbrains.mps.lang.editor.structure.CellModel_Property" flags="sg" stub="730538219796134133" index="3F0A7n" />
      <concept id="1219418625346" name="jetbrains.mps.lang.editor.structure.IStyleContainer" flags="ng" index="3F0Thp">
        <child id="1219418656006" name="styleItem" index="3F10Kt" />
      </concept>
      <concept id="1073390211982" name="jetbrains.mps.lang.editor.structure.CellModel_RefNodeList" flags="sg" stub="2794558372793454595" index="3F2HdR" />
      <concept id="1198256887712" name="jetbrains.mps.lang.editor.structure.CellModel_Indent" flags="ng" index="3XFhqQ" />
      <concept id="1166049232041" name="jetbrains.mps.lang.editor.structure.AbstractComponent" flags="ng" index="1XWOmA">
        <reference id="1166049300910" name="conceptDeclaration" index="1XX52x" />
      </concept>
    </language>
  </registry>
  <node concept="24kQdi" id="5w2nDnaB6zL">
    <ref role="1XX52x" to="uaqk:5w2nDnaB6ww" resolve="Parent" />
    <node concept="3EZMnI" id="5w2nDnaB6zO" role="2wV5jI">
      <node concept="3EZMnI" id="5w2nDnaB6zV" role="3EZMnx">
        <node concept="VPM3Z" id="5w2nDnaB6zX" role="3F10Kt" />
        <node concept="3F0ifn" id="5w2nDnaB6$5" role="3EZMnx">
          <property role="3F0ifm" value="parent" />
        </node>
        <node concept="2iRfu4" id="5w2nDnaB6$0" role="2iSdaV" />
        <node concept="3F0A7n" id="5w2nDnaB6$f" role="3EZMnx">
          <ref role="1NtTu8" to="tpck:h0TrG11" resolve="name" />
        </node>
        <node concept="3F0ifn" id="5w2nDnaB6_2" role="3EZMnx">
          <property role="3F0ifm" value="{" />
        </node>
      </node>
      <node concept="2iRkQZ" id="5w2nDnaB6zR" role="2iSdaV" />
      <node concept="3EZMnI" id="5w2nDnaB6$w" role="3EZMnx">
        <node concept="VPM3Z" id="5w2nDnaB6$y" role="3F10Kt" />
        <node concept="3XFhqQ" id="5w2nDnaB6$J" role="3EZMnx" />
        <node concept="2iRfu4" id="5w2nDnaB6$_" role="2iSdaV" />
        <node concept="3F2HdR" id="5w2nDnaB6$P" role="3EZMnx">
          <ref role="1NtTu8" to="uaqk:5w2nDnaB6wG" resolve="children" />
          <node concept="2iRkQZ" id="5w2nDnaB6$S" role="2czzBx" />
          <node concept="VPM3Z" id="5w2nDnaB6$T" role="3F10Kt" />
        </node>
      </node>
      <node concept="3F0ifn" id="5w2nDnaB6_7" role="3EZMnx">
        <property role="3F0ifm" value="}" />
      </node>
    </node>
  </node>
  <node concept="24kQdi" id="5w2nDnaB6_t">
    <ref role="1XX52x" to="uaqk:5w2nDnaB6wz" resolve="Root" />
    <node concept="3EZMnI" id="5w2nDnaB6_v" role="2wV5jI">
      <node concept="3EZMnI" id="5w2nDnaB6_A" role="3EZMnx">
        <node concept="VPM3Z" id="5w2nDnaB6_B" role="3F10Kt" />
        <node concept="3F0ifn" id="5w2nDnaB6_C" role="3EZMnx">
          <property role="3F0ifm" value="root" />
        </node>
        <node concept="2iRfu4" id="5w2nDnaB6_D" role="2iSdaV" />
        <node concept="3F0A7n" id="5w2nDnaB6_E" role="3EZMnx">
          <ref role="1NtTu8" to="tpck:h0TrG11" resolve="name" />
        </node>
        <node concept="3F0ifn" id="5w2nDnaB6_F" role="3EZMnx">
          <property role="3F0ifm" value="{" />
        </node>
      </node>
      <node concept="3EZMnI" id="5w2nDnaB6_G" role="3EZMnx">
        <node concept="VPM3Z" id="5w2nDnaB6_H" role="3F10Kt" />
        <node concept="3XFhqQ" id="5w2nDnaB6_I" role="3EZMnx" />
        <node concept="2iRfu4" id="5w2nDnaB6_J" role="2iSdaV" />
        <node concept="3F2HdR" id="5w2nDnaB6_K" role="3EZMnx">
          <ref role="1NtTu8" to="uaqk:5w2nDnaB6w_" resolve="content" />
          <node concept="2iRkQZ" id="5w2nDnaB6_L" role="2czzBx" />
          <node concept="VPM3Z" id="5w2nDnaB6_M" role="3F10Kt" />
        </node>
      </node>
      <node concept="3F0ifn" id="5w2nDnaB6_N" role="3EZMnx">
        <property role="3F0ifm" value="}" />
      </node>
      <node concept="2iRkQZ" id="5w2nDnaB6_y" role="2iSdaV" />
    </node>
  </node>
</model>

